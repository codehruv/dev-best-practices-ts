{
  description = "Pinned toolchain for dev-best-practices-ts";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # nixpkgs does not package oasdiff, so the upstream release binary is pinned by
        # version and hash. CI installs the same version (.github/workflows/api-check.yaml).
        oasdiffRelease =
          {
            aarch64-darwin = {
              asset = "darwin_all";
              hash = "sha256-KkeTN8Fa/cvwseicC00M8BdkctvBFIM1j+0fgx0eRsU=";
            };
            x86_64-darwin = {
              asset = "darwin_all";
              hash = "sha256-KkeTN8Fa/cvwseicC00M8BdkctvBFIM1j+0fgx0eRsU=";
            };
            x86_64-linux = {
              asset = "linux_amd64";
              hash = "sha256-Q6TjKOLRO6FVLXYKpo0khcdcViHzCfb/ZK6JUYg0Ukc=";
            };
            aarch64-linux = {
              asset = "linux_arm64";
              hash = "sha256-SuPDYtYHTZGaraLeqC0O6ENmWRYAOERV0L3GWN34964=";
            };
          }
          .${system};
        oasdiff = pkgs.stdenvNoCC.mkDerivation rec {
          pname = "oasdiff";
          version = "1.33.0";
          src = pkgs.fetchurl {
            url = "https://github.com/oasdiff/oasdiff/releases/download/v${version}/oasdiff_${version}_${oasdiffRelease.asset}.tar.gz";
            inherit (oasdiffRelease) hash;
          };
          sourceRoot = ".";
          installPhase = "install -Dm755 oasdiff $out/bin/oasdiff";
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            git
            just
            lefthook
            gitleaks
            ripgrep
            jq
            actionlint
            zizmor
            oasdiff
          ];

          # pnpm comes from Corepack so its version always matches `packageManager` in
          # package.json, which nixpkgs cannot guarantee.
          # Anchored at the repo root, so entering the shell from a subdirectory reuses
          # the same install.
          shellHook = ''
            repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            export COREPACK_HOME="$repo_root/.direnv/corepack"
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
            mkdir -p "$repo_root/.direnv/bin"
            corepack enable --install-directory "$repo_root/.direnv/bin" pnpm
            export PATH="$repo_root/.direnv/bin:$PATH"
          '';
        };
      }
    );
}
