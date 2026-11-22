#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v ruby >/dev/null 2>&1; then
  echo "Ruby is required. Install Ruby 3.3 or 3.4 and follow README.md." >&2
  exit 1
fi

if ! command -v bundle >/dev/null 2>&1; then
  echo "Bundler is required. Run: gem install bundler -v 2.6.9" >&2
  exit 1
fi

export BUNDLE_PATH="$PWD/vendor/bundle"
export BUNDLE_FROZEN=true

if [ "$(uname -s)" = Darwin ]; then
  # Match native extensions to Ruby, including Intel Ruby on Apple Silicon.
  ruby_arch=$(ruby -rrbconfig -e 'print RbConfig::CONFIG["host_cpu"]')
  CONFIGURE_ARGS="${CONFIGURE_ARGS:-} --with-arch_flag='-arch $ruby_arch'"
  export CONFIGURE_ARGS
fi

echo "Preparing the local preview at http://localhost:${PREVIEW_PORT:-4000}/"

if ! bundle check; then
  bundle install --jobs 2
fi

exec bundle exec jekyll serve \
  --host 127.0.0.1 \
  --port "${PREVIEW_PORT:-4000}" \
  --force_polling
