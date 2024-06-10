{
  sources ? import ./sources.nix,
  nixpkgs ? sources.nixpkgs,
  niv ? sources.niv,
  mkCli ? sources.mkCli,
}: let
  niv-overlay = self: _: {
    niv = self.symlinkJoin {
      name = "niv";
      paths = [niv];
      buildInputs = [self.makeWrapper];
      postBuild = ''
        wrapProgram $out/bin/niv \
          --add-flags "--sources-file ${toString ./sources.json}"
      '';
    };
  };

  mkCli-overlay = import "${mkCli}/overlay.nix";

  nodejs-overlay = _: super: {
    nodejs = super.nodejs_18;
  };

  pkgs = import nixpkgs {
    overlays = [
      niv-overlay
      mkCli-overlay
      nodejs-overlay
    ];
    config = {};
  };

  cli = pkgs.lib.mkCli "cli" {
    _noAll = true;

    install = "${pkgs.nodePackages.pnpm}/bin/pnpm i";

    test = {
      nix = {
        lint = "${pkgs.statix}/bin/statix check --ignore node_modules .";
        dead-code = "${pkgs.deadnix}/bin/deadnix --exclude ./node_modules .";
        format = "${pkgs.alejandra}/bin/alejandra --exclude ./node_modules --check .";
      };
    };

    fix = {
      nix = {
        lint = "${pkgs.statix}/bin/statix fix --ignore node_modules .";
        dead-code = "${pkgs.deadnix}/bin/deadnix --exclude ./node_modules -e .";
        format = "${pkgs.alejandra}/bin/alejandra --exclude ./node_modules .";
      };
    };
  };
in
  pkgs.mkShell {
    FORCE_COLOR = 1;
    buildInputs = [
      cli
      pkgs.git
      pkgs.niv
      pkgs.nodejs
      pkgs.python3
      pkgs.pkg-config
      pkgs.nodePackages.pnpm
      pkgs.cargo
      pkgs.pre-commit
    ];
  }
