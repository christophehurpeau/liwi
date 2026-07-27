<h3 align="center">
  liwi-mongo-example
</h3>

<p align="center">
  minimal liwi-mongo usage example
</p>

## About

Private example package (not published). A single script, [`src/users.ts`](src/users.ts), exercising [`liwi-mongo`](../liwi-mongo) against a real MongoDB: connect, insert, partial updates (`$set`, `$push`), lookups by criteria and by key, with `assert` checks throughout.

For the client/server side of liwi (resources, subscriptions, React), see the [`@todo-example`](../../@todo-example) workspace instead.

## Run

Requires a MongoDB reachable on `localhost:27017`. The script uses the `liwi-mongo-example` database and **deletes every document in the `users` collection** on start.

```bash
pnpm --filter liwi-mongo-example run build
node packages/liwi-mongo-example/build/users-node.mjs
```

`pnpm --filter liwi-mongo-example run start` rebuilds on change.
