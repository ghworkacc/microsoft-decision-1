require "json"
require "net/http"
require "open3"
require "socket"
require "uri"

$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

# End-to-end check of a provisioned environment (run `azd up` first):
#   - the production build of the frontend is served and wired to the azd outputs
#   - the Entra app registration and Foundry CORS allow the browser sign-in + API call
#   - the Microsoft-Decision-1 deployment answers authenticated requests
#
# Instead of a browser MSAL sign-in, API calls use an `az` CLI token for the
# same audience (https://cognitiveservices.azure.com) the SPA requests.
module DecisionAppSpec
  FRONTEND_DIR = File.join(AzdSupport::Helpers::REPO_ROOT, "frontend")
  DEV_ORIGIN = "http://localhost:5173"
  COGNITIVE_SERVICES_RESOURCE = "https://cognitiveservices.azure.com"
  COGNITIVE_SERVICES_APP_ID = "7d312290-28c8-473c-a0ed-8e53749b6d6d"

  QUESTION = "In what way has the customer's question been responded?"
  CHOICES = {
    "answered" => "Answered",
    "promised_to_answer" => "Promised to answer",
    "changed_subject" => "Changed subject",
  }.freeze
  STATE = <<~STATE.strip
    Customer: I'm having trouble setting up my model deployment.  It says "error - name included a reserved word"
    Agent: The default deployment unfortunately used a reserved word.  To work around the issue, you need to create a custom deployment and provide it an alternative name (e.g. 'msft-decidobot-threesixtyfive').
  STATE
end

RSpec.describe "Decision app", integration: true do
  def capture!(*cmd, **opts)
    output, process_status = Open3.capture2e(*cmd, **opts)
    raise "#{cmd.join(" ")} failed:\n#{output}" unless process_status.success?

    output.strip
  end

  def free_port
    server = TCPServer.new("127.0.0.1", 0)
    server.addr[1]
  ensure
    server&.close
  end

  def wait_for_http(url, timeout: 30)
    deadline = Time.now + timeout
    begin
      Net::HTTP.get_response(URI(url))
    rescue Errno::ECONNREFUSED, Errno::ECONNRESET, EOFError
      raise "Timed out waiting for #{url}" if Time.now > deadline

      sleep 0.25
      retry
    end
  end

  before(:all) do
    @config = AzdSupport::Configuration.new
    @config.load_azd!
    @config.validate!("AZURE_TENANT_ID", "FOUNDRY_ENDPOINT", "DECISION_DEPLOYMENT_NAME", "ENTRA_CLIENT_ID")
  end

  def endpoint = @config["FOUNDRY_ENDPOINT"]
  def deployment_name = @config["DECISION_DEPLOYMENT_NAME"]
  def client_id = @config["ENTRA_CLIENT_ID"]

  describe "frontend" do
    before(:all) do
      capture!("pnpm", "build", chdir: DecisionAppSpec::FRONTEND_DIR)

      port = free_port
      @base_url = "http://127.0.0.1:#{port}"
      @server_pid = Process.spawn(
        "pnpm", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", port.to_s, "--strictPort",
        chdir: DecisionAppSpec::FRONTEND_DIR, out: File::NULL, err: File::NULL, pgroup: true
      )
      @index = wait_for_http("#{@base_url}/")
    end

    after(:all) do
      if @server_pid
        Process.kill("TERM", -@server_pid)
        Process.wait(@server_pid)
      end
    rescue Errno::ESRCH, Errno::ECHILD
      nil
    end

    it "serves the index page" do
      expect(@index.code).to eq("200")
      expect(@index.body).to include('<div id="root">')
    end

    it "serves a minified bundle configured from the azd environment" do
      script_path = @index.body[%r{<script[^>]+src="(/assets/[^"]+\.js)"}, 1]
      expect(script_path).not_to be_nil

      bundle = Net::HTTP.get_response(URI("#{@base_url}#{script_path}"))
      expect(bundle.code).to eq("200")
      expect(bundle.body).to include(client_id, endpoint, deployment_name)
      expect(bundle.body.lines.count).to be < 50
    end

    it "is registered as an Entra SPA for the local dev origin" do
      app = JSON.parse(capture!("az", "ad", "app", "show", "--id", client_id, "-o", "json"))

      expect(app.dig("spa", "redirectUris")).to include(DecisionAppSpec::DEV_ORIGIN)
      expect(app["requiredResourceAccess"].map { |r| r["resourceAppId"] })
        .to include(DecisionAppSpec::COGNITIVE_SERVICES_APP_ID)
    end

    it "is allowed by Foundry CORS to call the decision API" do
      uri = URI("#{endpoint}/providers/microsoft/v1/systemone")
      preflight = Net::HTTPGenericRequest.new("OPTIONS", false, true, uri.request_uri)
      preflight["Origin"] = DecisionAppSpec::DEV_ORIGIN
      preflight["Access-Control-Request-Method"] = "POST"
      preflight["Access-Control-Request-Headers"] = "authorization,content-type"

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(preflight) }

      expect(response["Access-Control-Allow-Origin"]).to eq("*").or eq(DecisionAppSpec::DEV_ORIGIN)
    end
  end

  describe "decision API" do
    def decide(token:)
      uri = URI("#{endpoint}/providers/microsoft/v1/systemone")
      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request["Authorization"] = "Bearer #{token}" if token
      request.body = {
        model: deployment_name,
        state: DecisionAppSpec::STATE,
        questions: {
          decision: { type: "choice", instructions: DecisionAppSpec::QUESTION, criteria: DecisionAppSpec::CHOICES },
        },
      }.to_json

      Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) { |http| http.request(request) }
    end

    it "rejects unauthenticated requests" do
      expect(decide(token: nil).code).to eq("401")
    end

    it "answers the demo question with the deployed model" do
      token = capture!(
        "az", "account", "get-access-token", "--resource", DecisionAppSpec::COGNITIVE_SERVICES_RESOURCE,
        "--query", "accessToken", "-o", "tsv"
      )

      response = decide(token: token)
      expect(response.code).to eq("200"), response.body

      answer = JSON.parse(response.body).dig("answers", "decision")
      expect(answer["choice"]).to eq("answered")
      expect(answer["confidence"]).to be > 0.5
      expect(answer["probabilities"].keys).to match_array(DecisionAppSpec::CHOICES.keys)
      expect(answer["probabilities"].values.sum).to be_within(0.01).of(1.0)
    end
  end
end
