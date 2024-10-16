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
          cli = let
            pnpm = "${prev.pnpm}/bin/pnpm i && ${prev.pnpm}/bin/pnpm";
          in
            prev.lib.mkCli "cli" {
              _noAll = true;

              install = "${pnpm} i";
              start = "${pnpm} lerna run start:dev";

              test = {
                nix = {
                  lint = "${prev.statix}/bin/statix check --ignore node_modules .";
                  dead-code = "${prev.deadnix}/bin/deadnix --exclude ./node_modules .";
                  format = "${prev.alejandra}/bin/alejandra --exclude ./node_modules --check .";
                };
              };

              fix = {
                nix = {
                  lint = "${prev.statix}/bin/statix fix --ignore node_modules .";
                  dead-code = "${prev.deadnix}/bin/deadnix --exclude ./node_modules -e .";
                  format = "${prev.alejandra}/bin/alejandra --exclude ./node_modules .";
                };
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
            pkgs.cargo
            pkgs.cli
            pkgs.git
            pkgs.libusb
            pkgs.nodejs
            pkgs.pkg-config
            pkgs.pnpm
            pkgs.pre-commit
            pkgs.python3
            pkgs.python3Packages.distutils
          ];
        };
      }
    )
  );
}
