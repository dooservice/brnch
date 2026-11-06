# Short commands for the Docker workflow. Nothing is installed on the host.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

COMPOSE := docker compose run --rm

.PHONY: help images test integration lint format add check frontend-install frontend-test frontend-build

help:
	@echo "make images                     Build the Docker images"
	@echo "make test                       Run every test"
	@echo "make integration                Run the tests that need a real gitd (started in Docker)"
	@echo "make lint                       Check formatting and clippy"
	@echo "make format                     Format the Rust code"
	@echo "make add PACKAGE=brnch-core DEPENDENCY=thiserror"
	@echo "                                Add a dependency with cargo add (latest version)"

images:
	docker compose build

test:
	$(COMPOSE) core cargo test --workspace

# Starts gitd in Docker, runs the ignored tests against it, and always stops it afterwards.
integration:
	mkdir -p .cache/gitd/state .cache/gitd/run
	docker compose up --detach --wait gitd
	$(COMPOSE) integration cargo test --workspace -- --ignored; status=$$?; \
		docker compose down; exit $$status

check:
	$(COMPOSE) core cargo check --workspace --all-targets

lint:
	$(COMPOSE) core sh -c "cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings"

format:
	$(COMPOSE) core cargo fmt --all

add:
	@test -n "$(PACKAGE)" -a -n "$(DEPENDENCY)" || (echo "Usage: make add PACKAGE=brnch-core DEPENDENCY=thiserror" && exit 1)
	$(COMPOSE) core cargo add $(DEPENDENCY) --package $(PACKAGE) $(ADD_FLAGS)

frontend-install:
	mkdir -p apps/desktop .cache/home
	$(COMPOSE) frontend npm install

frontend-test:
	$(COMPOSE) frontend npm test

frontend-build:
	$(COMPOSE) frontend npm run build
