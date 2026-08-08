cask "tasteful-intent" do
  arch arm: "aarch64", intel: "x64"

  version "0.0.0"
  sha256 arm:   "0000000000000000000000000000000000000000000000000000000000000000",
         intel: "0000000000000000000000000000000000000000000000000000000000000000"

  url "https://github.com/tkhwang/tasteful-intent/releases/download/v#{version}/TastefulIntent_#{version}_#{arch}.dmg"
  name "Tasteful Intent"
  desc "Markdown memo editor for intent and taste"
  homepage "https://github.com/tkhwang/tasteful-intent"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "TastefulIntent.app"

  uninstall quit: "app.tkbetter.intentmemo"

end
