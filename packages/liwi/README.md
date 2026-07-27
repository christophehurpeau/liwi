<h3 align="center">
  liwi
</h3>

<p align="center">
  db abstraction (deprecated umbrella)
</p>

# Deprecated — use `liwi-mongo` instead.

This package is an empty umbrella kept for historical reasons; it ships no code. Depend directly on the package you need:

| Need                            | Package                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| Mongo store                     | [`liwi-mongo`](../liwi-mongo)                                     |
| Store contract (custom backend) | [`liwi-store`](../liwi-store)                                     |
| Live queries over a store       | [`liwi-subscribe-store`](../liwi-subscribe-store)                 |
| Expose resources to clients     | [`liwi-resources-server`](../liwi-resources-server)               |
| Consume resources               | [`liwi-resources-client`](../liwi-resources-client) + a transport |
| React bindings                  | [`react-liwi`](../react-liwi)                                     |

See the [monorepo README](../../README.md) for how the pieces fit together.
