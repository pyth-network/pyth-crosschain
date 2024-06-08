let
  nivSrc = fetchTarball {
    url = "https://github.com/nmattia/niv/tarball/ecabfde837ccfb392ccca235f96bfcf4bb8ab186";
    sha256 = "1aij19grvzbxj0dal49bsnhq1lc23nrglv6p0f00gwznl6109snj";
  };
  sources = import "${nivSrc}/nix/sources.nix" {
    sourcesFile = ./sources.json;
  };
  niv = import nivSrc {};
in
  niv // sources
