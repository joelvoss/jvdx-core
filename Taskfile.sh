#!/bin/bash

set -e

PATH=./node_modules/.bin:$PATH

# Export environment variables from `.env`
if [ -f .env ]
then
  export $(cat .env | sed 's/#.*//g' | xargs)
fi

# //////////////////////////////////////////////////////////////////////////////
# BEGIN tasks

# Format source code
format() {
  node src/index.js format $*
}

# Lint project
lint() {
  node src/index.js lint $*
}

# Run tests
test() {
  node src/index.js test --testPathPattern=tests $*
}

# Validate application
validate() {
  lint $*
  test $*
}

# Clean project root
clean() {
  node src/index.js clean $*
}

# Default task
default() { validate; }

# END tasks
# //////////////////////////////////////////////////////////////////////////////

${@:-default}
