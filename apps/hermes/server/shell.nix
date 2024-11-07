{pkgs ? import <nixpkgs> {}, ...}:
with pkgs;
  mkShell {
    buildInputs = [
      clang
      llvmPackages.libclang
      nettle
      openssl_1_1
      pkg-config
      iconv
      protobuf
      go
      rustup
      curl
    ];

    shellHook = ''
      export LIBCLANG_PATH="${llvmPackages.libclang.lib}/lib";
      export CPATH="${darwin.Libsystem}/include";
    '';
  }
