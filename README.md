# require-phoenix

Reloading local modules on the fly.

## How?
When you require any file (not module from npm or native NodeJS module) using `require-phoenix`, it tracks a module caller. When you decide to apply updadates from disk (reload modules), `require-phoenix` will look up to callers tree and will purge cache for changed modules and all modules that called these changed modules. Then, on the next call, `require-phoenix` will return updated module so you need to require modules using getters or require them inside functions (e.g. require a file depending on HTTP path of request) to get updates.
