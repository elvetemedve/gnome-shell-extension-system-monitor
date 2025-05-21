{
  description = "A Nix-flake-based development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self , nixpkgs ,... }: let
    system = "x86_64-linux";
  in {
    devShells."${system}".default = let
      pkgs = import nixpkgs {
        inherit system;
      };
    in pkgs.mkShell {
      # Install dependencies to build and install the code
      packages = with pkgs; [
        rake
        glib
        zip
        unzip
      ];

      shellHook = ''
        export RUBYOPT=-W0 # Disable Ruby warnings
        echo "DEV Shell Started"
        echo ""
        exec fish -C "rake"
      '';
    };
  };
}
