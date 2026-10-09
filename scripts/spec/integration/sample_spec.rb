require "net/http"
require "uri"


RSpec.describe "Sample Integration Test", integration: true do
  describe "Hello World" do
    HELLO_HOST = "example.com"

    it "responds 200 with the expected greeting" do
      response = Net::HTTP.get_response(URI("http://#{HELLO_HOST}"))
      expect(response.code).to eq("200")
      expect(response.body).to include("html")
    end
  end
end
