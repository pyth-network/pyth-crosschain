{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    mkCli.url = "github:cprussin/mkCli";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    mkCli,
    ...
  }: (
    flake-utils.lib.eachDefaultSystem
    (
      system: let
        cli-overlay = _: prev: {
          cli = prev.lib.mkCli "cli" {
            _noAll = true;

            start = "${prev.lib.getExe prev.pnpm} turbo start:dev";

            test = {
              nix = {
                lint = "${prev.statix}/bin/statix check --ignore node_modules .";
                dead-code = "${prev.deadnix}/bin/deadnix --exclude ./node_modules .";
                format = "${prev.alejandra}/bin/alejandra --exclude ./node_modules --check .";
              };
              turbo = "${prev.lib.getExe prev.pnpm} turbo test -- --ui stream";
            };

            fix = {
              nix = {
                lint = "${prev.statix}/bin/statix fix --ignore node_modules .";
                dead-code = "${prev.deadnix}/bin/deadnix --exclude ./node_modules -e .";
                format = "${prev.alejandra}/bin/alejandra --exclude ./node_modules .";
              };
              turbo = "${prev.lib.getExe prev.pnpm} turbo fix -- --ui stream";
            };
          };
        };

        pkgs = import nixpkgs {
          inherit system;
          overlays = [mkCli.overlays.default cli-overlay];
          config = {};
        };
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.cli
            pkgs.git
            pkgs.libusb1
            pkgs.nodejs
            pkgs.pkg-config
            pkgs.pnpm
            pkgs.pre-commit
            pkgs.python3
            pkgs.python3Packages.distutils
            pkgs.graphviz
            pkgs.anchor
          ];
        };
      }
    )
  );
}
