require "json"
require "net/http"
require "securerandom"
require "uri"

$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

# End-to-end check of the anonymous proxy (run `azd up` first):
#   - App Service CORS allows only the configured origins
#   - ANONYMOUS_MODE=false refuses every request
#   - ANONYMOUS_MODE=true answers decisions and caps each client IP per minute,
#     even when the caller forges X-Forwarded-For
#
# With ANONYMOUS_MODE=true this spends up to ANONYMOUS_RATE_LIMIT_PER_MINUTE
# model calls.
module AnonymousApiSpec
  QUESTIONS = {
    "question_1" => { "type" => "noul", "instructions" => "Did the agent offer a workaround?" },
  }.freeze
  STATE = "Customer: My deployment name is rejected.\nAgent: Rename it to avoid the reserved word."
end

RSpec.describe "Anonymous decision proxy", integration: true do
  before(:all) do
    @config = AzdSupport::Configuration.new
    @config.load_azd!
    @proxy_url = @config["DECISION_PROXY_URL"].to_s.chomp("/")
    skip "DECISION_PROXY_URL is not set; run `azd provision`" if @proxy_url.empty?
  end

  def anonymous_mode? = @config["ANONYMOUS_MODE"].to_s.strip.casecmp?("true")
  def limit = Integer(@config["ANONYMOUS_RATE_LIMIT_PER_MINUTE"])
  def allowed_origin = @config["ANONYMOUS_CORS_ORIGINS"].split(",").first.strip

  def request(method, path, headers: {}, body: nil)
    uri = URI("#{@proxy_url}/#{path}")
    req = Net::HTTP.const_get(method.to_s.capitalize).new(uri)
    headers.each { |k, v| req[k] = v }
    if body
      req["Content-Type"] = "application/json"
      req.body = JSON.generate(body)
    end
    Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) { |http| http.request(req) }
  end

  def decide(headers: {})
    request(:post, "decision", headers: headers,
                                body: { "state" => AnonymousApiSpec::STATE, "questions" => AnonymousApiSpec::QUESTIONS })
  end

  def preflight(origin)
    request(:options, "decision", headers: {
      "Origin" => origin,
      "Access-Control-Request-Method" => "POST",
      "Access-Control-Request-Headers" => "content-type",
    })
  end

  describe "CORS" do
    it "allows the configured origin" do
      expect(preflight(allowed_origin)["Access-Control-Allow-Origin"]).to eq(allowed_origin)
    end

    it "does not allow other origins" do
      expect(preflight("https://evil.example")["Access-Control-Allow-Origin"]).to be_nil
    end
  end

  context "when ANONYMOUS_MODE is not true" do
    before { skip "ANONYMOUS_MODE=true" if anonymous_mode? }

    it "refuses quota and decision requests" do
      [request(:get, "quota"), decide].each do |response|
        expect(response.code).to eq("404")
        expect(JSON.parse(response.body).dig("error", "code")).to eq("AnonymousModeDisabled")
      end
    end
  end

  context "when ANONYMOUS_MODE is true" do
    before { skip "ANONYMOUS_MODE is not true" unless anonymous_mode? }

    def quota
      response = request(:get, "quota")
      expect(response.code).to eq("200")
      JSON.parse(response.body).fetch("rateLimit")
    end

    it "reports the configured limit" do
      expect(quota).to include("limit" => limit, "remaining" => a_value_between(0, limit))
    end

    it "caps requests per client per minute, ignoring forged X-Forwarded-For" do
      # Don't straddle a window boundary.
      reset = quota.fetch("resetSeconds")
      sleep(reset + 1) if reset < 20

      responses = []
      (limit + 1).times do
        responses << decide
        break if responses.last.code == "429"
      end

      *allowed, limited = responses
      allowed.each do |response|
        expect(response.code).to eq("200"), response.body
        body = JSON.parse(response.body)
        expect(body.dig("answers", "question_1", "type")).to eq("noul")
        expect(body.dig("rateLimit", "limit")).to eq(limit)
      end

      expect(limited.code).to eq("429")
      expect(Integer(limited["Retry-After"])).to be_between(1, 60)
      expect(JSON.parse(limited.body)).to include(
        "error" => include("code" => "RateLimited"),
        "rateLimit" => include("limit" => limit, "remaining" => 0)
      )

      forged = decide(headers: { "X-Forwarded-For" => "198.51.100.#{SecureRandom.random_number(250) + 1}" })
      expect(forged.code).to eq("429")
    end
  end
end
