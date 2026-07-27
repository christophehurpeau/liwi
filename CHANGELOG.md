# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [13.1.1](https://github.com/christophehurpeau/liwi/compare/v13.1.0...v13.1.1) (2026-07-27)

### Bug Fixes

* rename useResource.d.test-definitions.ts so oxfmt stops parsing it as ambient
* **store:** accept array dot notation without index, bind Document and Buffer, closes [#718](https://github.com/christophehurpeau/liwi/issues/718)

## [13.1.0](https://github.com/christophehurpeau/liwi/compare/v13.0.2...v13.1.0) (2026-07-05)

### Features

* **mongo:** add fields option to cursor and update tests
* remove transformer parameter from createQuerySingleItem and createQueryCollection methods in SubscribeStore

## [13.0.2](https://github.com/christophehurpeau/liwi/compare/v13.0.1...v13.0.2) (2026-07-05)

### Bug Fixes

* **liwi-resources-client:** expose ServiceOperation

## [13.0.1](https://github.com/christophehurpeau/liwi/compare/v13.0.0...v13.0.1) (2026-06-30)

Note: no notable changes


## [13.0.0](https://github.com/liwijs/liwi/compare/v12.0.0...v13.0.0) (2026-06-30)

### ⚠ BREAKING CHANGES

* update mongodb to v7
* use esbuild instead of pob-babel
* drop node 20
* update dependencies, change config from map to object
* require node 22
* drop node 18

### Features

* **deps:** update dependency mongodb to ^6.20.0 ([#673](https://github.com/liwijs/liwi/issues/673))
* **deps:** update dependency next to v14.2.10 [security] ([#532](https://github.com/liwijs/liwi/issues/532))
* **deps:** update dependency next to v15.3.0 ([#619](https://github.com/liwijs/liwi/issues/619))
* **deps:** update dependency next to v15.5.14 [security] ([#682](https://github.com/liwijs/liwi/issues/682))
* **deps:** update dependency ws to v8.17.1 [security] ([#535](https://github.com/liwijs/liwi/issues/535))
* **deps:** update dependency ws to v8.20.1 [security] ([#700](https://github.com/liwijs/liwi/issues/700))
* **deps:** update nightingale to v16 (major) ([#606](https://github.com/liwijs/liwi/issues/606))
* **deps:** update nightingale to v18 ([#679](https://github.com/liwijs/liwi/issues/679))
* drop node 20
* improve typings
* update
* update dependencies
* update dependencies, change config from map to object
* update mongodb
* update mongodb to v7
* update next
* update ws
* use esbuild instead of pob-babel

### Bug Fixes

* **deps:** update dependency classnames to v2.5.1 ([#420](https://github.com/liwijs/liwi/issues/420))
* **deps:** update dependency mongodb to ^6.21.0 ([#680](https://github.com/liwijs/liwi/issues/680))
* **deps:** update dependency next to v14.2.15 [security] ([#560](https://github.com/liwijs/liwi/issues/560))
* **deps:** update dependency next to v14.2.21 [security] ([#572](https://github.com/liwijs/liwi/issues/572))
* **deps:** update dependency next to v14.2.24 ([#584](https://github.com/liwijs/liwi/issues/584))
* **deps:** update dependency next to v15.2.3 [security] ([#599](https://github.com/liwijs/liwi/issues/599))
* **deps:** update dependency next to v15.2.4 [security] ([#613](https://github.com/liwijs/liwi/issues/613))
* **deps:** update dependency next to v15.3.3 [security] ([#632](https://github.com/liwijs/liwi/issues/632))
* **deps:** update dependency next to v15.5.18 [security] ([#699](https://github.com/liwijs/liwi/issues/699))
* **deps:** update dependency react-native-web to v0.19.13 ([#523](https://github.com/liwijs/liwi/issues/523))
* **deps:** update dependency react-native-web to v0.21.2 ([#643](https://github.com/liwijs/liwi/issues/643))
* **deps:** update dependency ws to ^8.21.0 ([#698](https://github.com/liwijs/liwi/issues/698))
* **deps:** update ip and socks dependencies in yarn.lock
* **liwi-mongo:** use encodeURIComponent on user password database when building connection string
* mongoConfig readonly object
* remove eslint disable for unresolved import in server rendering
* remove unwanted import pob-babel
* resolve runtime import for entry server to handle missing built artifacts
* update alp
* update playwright and add missing router-segments

### Miscellaneous Chores

* require node 22

## 12.0.0 (2024-03-30)


### ⚠ BREAKING CHANGES

* update dev deps incuding babel which changes supported built files for browser

### Features

* **deps:** update dependency classnames to v2.4.0 ([#416](https://github.com/liwijs/liwi/issues/416)) ([30d6a24](https://github.com/liwijs/liwi/commit/30d6a24940da19ff1fadf134cca2eee5379eed6f))
* **deps:** update dependency classnames to v2.5.0 ([#419](https://github.com/liwijs/liwi/issues/419)) ([6468907](https://github.com/liwijs/liwi/commit/646890758155ac8a55c176b8f3d77c1663900c59))
* **deps:** update dependency mongodb to v6 ([#298](https://github.com/liwijs/liwi/issues/298)) ([96c5838](https://github.com/liwijs/liwi/commit/96c5838d006cbefaf96f466bfc802888795ce7e1))
* **deps:** update dependency nightingale-app-console to v14.2.1 ([#362](https://github.com/liwijs/liwi/issues/362)) ([0289e84](https://github.com/liwijs/liwi/commit/0289e842033e142d6e74ae52c63c1d095a6c8c47))
* **deps:** update dependency router-segments to v9 ([#402](https://github.com/liwijs/liwi/issues/402)) ([812f8e8](https://github.com/liwijs/liwi/commit/812f8e89a8afa32be61f21f559956649320c88c7))
* **deps:** update nightingale to v15 (major) ([#404](https://github.com/liwijs/liwi/issues/404)) ([f4e3338](https://github.com/liwijs/liwi/commit/f4e33387072b727a08ee095d9f01e41d9d4e7a1e))


### Bug Fixes

* **deps:** update dependency classnames to v2.3.3 ([#411](https://github.com/liwijs/liwi/issues/411)) ([eaff9fa](https://github.com/liwijs/liwi/commit/eaff9fa70f22e51ace2f6c09812bf4241dc73b1c))
* **deps:** update dependency next to v14.0.3 ([#369](https://github.com/liwijs/liwi/issues/369)) ([485281e](https://github.com/liwijs/liwi/commit/485281ef1406123bba9d1a3c3eddf7a1f7b1dcce))
* **deps:** update dependency react-native-web to v0.19.10 ([#409](https://github.com/liwijs/liwi/issues/409)) ([c9f412f](https://github.com/liwijs/liwi/commit/c9f412f2a8b2fe71331297266de9e091f1ee6b06))
* **deps:** update dependency react-native-web to v0.19.9 ([#292](https://github.com/liwijs/liwi/issues/292)) ([b958d50](https://github.com/liwijs/liwi/commit/b958d50efaab244fdbc98ccc12fe462179e95f63))
* **deps:** update dependency router-segments to v7.0.1 ([#357](https://github.com/liwijs/liwi/issues/357)) ([292d051](https://github.com/liwijs/liwi/commit/292d051bcd4e5a3832710e6630972f4dfe3d28c7))
* **deps:** update dependency todomvc-app-css to v2.4.3 ([#352](https://github.com/liwijs/liwi/issues/352)) ([6a44198](https://github.com/liwijs/liwi/commit/6a441985b76f8abfb764b60020f49a47620bf4a7))
* **liwi-mongo:** properly implement forEach ([2fb838b](https://github.com/liwijs/liwi/commit/2fb838b4b81ccb109946a9d0203485488085f632))
* update alp-node ([43b6ccf](https://github.com/liwijs/liwi/commit/43b6ccfeb5ceb2ffb3635f4b3c8836d375ef0864))


### Miscellaneous Chores

* update dev deps incuding babel which changes supported built files for browser ([462bf2e](https://github.com/liwijs/liwi/commit/462bf2e0bb3a6b8c9304106bc447bd248e3a61c7))


## [11.0.0](https://github.com/liwijs/liwi/compare/v10.5.0...v11.0.0) (2023-07-29)


### ⚠ BREAKING CHANGES

* drop node 16

### Bug Fixes

* fix modules config ([f34cee8](https://github.com/liwijs/liwi/commit/f34cee860f968b0dcc79b20d55d9e2b08dd1c04a))


### Code Refactoring

* update to node 18 ([e2dcbf8](https://github.com/liwijs/liwi/commit/e2dcbf8f5f6f32da6daa583fe352a453231c0c40))



## [10.5.0](https://github.com/liwijs/liwi/compare/v10.4.0...v10.5.0) (2023-07-28)


### Features

* **deps:** update nightingale to v14 (major) ([#258](https://github.com/liwijs/liwi/issues/258)) ([478f72b](https://github.com/liwijs/liwi/commit/478f72bfaa969d44fbc390a62944568d98bb75cf))



## [10.4.0](https://github.com/liwijs/liwi/compare/v10.3.3...v10.4.0) (2023-07-28)


### Features

* **deps:** update dependency mongodb to v5 ([#187](https://github.com/liwijs/liwi/issues/187)) ([ace5a92](https://github.com/liwijs/liwi/commit/ace5a92f8753d982882c35b37cdc0a488c97ec2f))
* **deps:** update dependency react-native-web to v0.19.0 ([#218](https://github.com/liwijs/liwi/issues/218)) ([929a667](https://github.com/liwijs/liwi/commit/929a667c43047c6ae2c4f6d4eec74aaaee54bfaa))
* rename connectedUser to loggedInUser ([83bb095](https://github.com/liwijs/liwi/commit/83bb095c5d9dfafef2d59b1fe1f32cac26c4fd6a))


### Bug Fixes

* add types in exports for typescript 5 ([0630185](https://github.com/liwijs/liwi/commit/0630185dee33a72b43b29848d6001bb54cb4c4b9))
* fix lint error ([517aed1](https://github.com/liwijs/liwi/commit/517aed1ea369ae7c4585ce8f744cab545da9d103))
* fix lint error ([ebb046f](https://github.com/liwijs/liwi/commit/ebb046ff5dd476e8921b3cfd1eef706b192e88ce))



## [10.3.3](https://github.com/liwijs/liwi/compare/v10.3.2...v10.3.3) (2023-02-05)


### Bug Fixes

* **deps:** update dependency react-native-web to v0.18.12 ([#180](https://github.com/liwijs/liwi/issues/180)) ([f3b5957](https://github.com/liwijs/liwi/commit/f3b5957340923f5edf64e6e38d7310948f845a6d))
* **react-liwi:** fix when a change happen before initial result ([0cfafb8](https://github.com/liwijs/liwi/commit/0cfafb816934568abc1f6e1833c55a021d37d7b2))





## [10.3.2](https://github.com/liwijs/liwi/compare/v10.3.1...v10.3.2) (2023-01-31)


### Bug Fixes

* fix Criteria type ([22cbed8](https://github.com/liwijs/liwi/commit/22cbed8d80e49bd2a00a47c216f658b96397b702))





## [10.3.1](https://github.com/liwijs/liwi/compare/v10.3.0...v10.3.1) (2023-01-31)


### Bug Fixes

* **liwi-store:** allow anything in criteria ([887eb9c](https://github.com/liwijs/liwi/commit/887eb9c67bd68fcc8b82007cdc6aa11554972526))





# [10.3.0](https://github.com/liwijs/liwi/compare/v10.2.0...v10.3.0) (2023-01-31)


### Features

* **liwi-store:** allow regex as object with pattern and options ([7e62bda](https://github.com/liwijs/liwi/commit/7e62bdafbf1b134294354edb3af74d794850fc85))





# [10.2.0](https://github.com/liwijs/liwi/compare/v10.1.3...v10.2.0) (2023-01-31)


### Features

* **liwi-mongo-example:** update mongo example ([cf4a895](https://github.com/liwijs/liwi/commit/cf4a895fb783b394323df61d893143682bfdc944))
* update mingo and fix typings ([4ed585e](https://github.com/liwijs/liwi/commit/4ed585e82c20f07ee9a7e1587b8ad37648872b62))
* update mongo ([96f189d](https://github.com/liwijs/liwi/commit/96f189da0f43582f8703998596208b2a5c2ed528))





## [10.1.3](https://github.com/liwijs/liwi/compare/v10.1.2...v10.1.3) (2023-01-29)


### Bug Fixes

* **liwi-mongo:** ignore $text not $search ([80225b2](https://github.com/liwijs/liwi/commit/80225b264b57960d521401e80a64b74a265bdf18))





## [10.1.2](https://github.com/liwijs/liwi/compare/v10.1.1...v10.1.2) (2023-01-29)


### Bug Fixes

* **deps:** update dependency react-native-web to v0.18.11 ([#173](https://github.com/liwijs/liwi/issues/173)) ([2534b88](https://github.com/liwijs/liwi/commit/2534b881ba270784c794c456ac959f23c72b6110))
* **liwi-monogo:** fix createTestCriteria for unsupported $search criteria ([e572148](https://github.com/liwijs/liwi/commit/e57214831e14a193ad2c5dec16c3873c25e1c076))
* **react-liwi:** typescript fix OperationCallWrapper second value of tuple Promise type ([c1c1b1f](https://github.com/liwijs/liwi/commit/c1c1b1f7fbff0b795732aaf345c50bee096be96e))





## [10.1.1](https://github.com/liwijs/liwi/compare/v10.1.0...v10.1.1) (2022-12-10)


### Bug Fixes

* **liwi-mongo:** meta count using criteria ([e2347ad](https://github.com/liwijs/liwi/commit/e2347adb00e229c78a7b8523b1ac06beb6ca0545))





# [10.1.0](https://github.com/liwijs/liwi/compare/v10.0.0...v10.1.0) (2022-11-27)


### Features

* allow async query in server service resource ([e153310](https://github.com/liwijs/liwi/commit/e15331086638176ba45258fda206ea337ccdae0c))





# [10.0.0](https://github.com/liwijs/liwi/compare/v9.2.0...v10.0.0) (2022-11-27)


### Bug Fixes

* **deps:** update dependency next to v13.0.4 ([#118](https://github.com/liwijs/liwi/issues/118)) ([a4f94d5](https://github.com/liwijs/liwi/commit/a4f94d56a7a2a4eb7d69bed332a7d6122654c7a0))
* **deps:** update dependency react-alp-connection-state to v6.2.2 ([#112](https://github.com/liwijs/liwi/issues/112)) ([7216015](https://github.com/liwijs/liwi/commit/7216015341febb823ec2eea2edfc57ee4d595996))
* **deps:** update dependency react-native-web to v0.18.10 ([#71](https://github.com/liwijs/liwi/issues/71)) ([36a1d19](https://github.com/liwijs/liwi/commit/36a1d19bf7ec154fcfc24d64c272ed83f64c8645))
* log expected ResourcesServerError as info, not as error ([508caf7](https://github.com/liwijs/liwi/commit/508caf7c6053427effb6e7c82f99862f2e10a997))


### Code Refactoring

* drop node 14 and cjs ([b7035bd](https://github.com/liwijs/liwi/commit/b7035bd2289982ef56d3e560f4f3f308e90a555e))


### Features

* **deps:** update nightingale to v13 (major) ([#128](https://github.com/liwijs/liwi/issues/128)) ([f04d7fe](https://github.com/liwijs/liwi/commit/f04d7fe2deba3f20733ff945a35c61098139d8a9))
* **react-liwi:** export PaginatedQueryRequiredParams and Pagination ([deb4afb](https://github.com/liwijs/liwi/commit/deb4afbe95c45c2c63aeb5565ac996008f8e84ce))


### BREAKING CHANGES

* dropped node 14 and cjs





# [9.2.0](https://github.com/liwijs/liwi/compare/v9.1.0...v9.2.0) (2022-10-29)


### Bug Fixes

* **deps:** update dependency classnames to v2.3.2 ([#102](https://github.com/liwijs/liwi/issues/102)) ([51b5ed2](https://github.com/liwijs/liwi/commit/51b5ed27d027789eeaf4db3e1957096f8d66fda4))
* **liwi-resources-websocket-client:** throw on ssr to avoid leaks ([871c668](https://github.com/liwijs/liwi/commit/871c668d0a25065c067a737326a5f94f21db2c60))


### Features

* update to nextjs 13 ([6c0b136](https://github.com/liwijs/liwi/commit/6c0b136090645f6c66a94305cd86c6f3bcfe3849))
* update to react 18 ([1c8ea60](https://github.com/liwijs/liwi/commit/1c8ea60004d01fee8ca784f1e10213ff69835015))





# [9.1.0](https://github.com/liwijs/liwi/compare/v9.0.0...v9.1.0) (2022-10-08)


### Bug Fixes

* add missing keyof Model in $pull operator ([47062d9](https://github.com/liwijs/liwi/commit/47062d9e4b9bfb3d55adae8aeb77ac8abd04dc20))
* add missing keyof Model in $push operator ([be7f0e1](https://github.com/liwijs/liwi/commit/be7f0e1e4da40b035528c94ebe98a373135ac066))
* **deps:** update dependency react-native-web to v0.17.7 ([#32](https://github.com/liwijs/liwi/issues/32)) ([4ff8199](https://github.com/liwijs/liwi/commit/4ff81994b5c3462e376382a9aea8e1d86463a382))
* fix not subscribing when skip is true ([cd346e7](https://github.com/liwijs/liwi/commit/cd346e7f5afdd31b593cc36b21bcb2401cd46231))
* **liwi-types:** fix Criteria generic in Criteria ([4e3ed4d](https://github.com/liwijs/liwi/commit/4e3ed4d63f3267b5c2770ade8ceab1b2a5b64b48))
* redact connectionString in logs ([236ecb2](https://github.com/liwijs/liwi/commit/236ecb2b812c4d48ae0028b91e93528ddc899f1b))
* remix eslint config root ([bf24ff5](https://github.com/liwijs/liwi/commit/bf24ff53a7a4e3e5c99d3fff23b7b5fbdb6eeb31))
* update dev dependencies, fix ts remix, fix next babel config ([fadb30e](https://github.com/liwijs/liwi/commit/fadb30e9620fbbcb99cfbc6a7db78d9ef2dad5e2))


### Features

* add example with remix ([9d1e631](https://github.com/liwijs/liwi/commit/9d1e631f4bc178258f3d888eb0c673e41f1e98ef))
* **deps:** update dependency next to v12.2.5 ([#77](https://github.com/liwijs/liwi/issues/77)) ([f7d5650](https://github.com/liwijs/liwi/commit/f7d5650317bbbb010638e42777d0924f34914c36))
* **deps:** update dependency react-native to v0.18.7 ([#68](https://github.com/liwijs/liwi/issues/68)) ([b7ddc9a](https://github.com/liwijs/liwi/commit/b7ddc9a60a5a09cc2ba77950842c0bfd4348cdb8))





# [9.0.0](https://github.com/liwijs/liwi/compare/v8.3.1...v9.0.0) (2022-03-05)


### Bug Fixes

* **deps:** update dependency react-alp-connection-state to v6.0.1 ([#23](https://github.com/liwijs/liwi/issues/23)) ([e1ca9bc](https://github.com/liwijs/liwi/commit/e1ca9bc62db60cd29d584b17f61e6718f53cd43d))
* **deps:** update dependency react-native-web to v0.17.6 ([#16](https://github.com/liwijs/liwi/issues/16)) ([453772b](https://github.com/liwijs/liwi/commit/453772bd4ab26c1e7f110b68eb200fc52f8ff458))
* config next ([5852893](https://github.com/liwijs/liwi/commit/5852893bfa1d5d63605daf23abcc5a2c8cb92cb1))
* update meta when params change ([7c260a8](https://github.com/liwijs/liwi/commit/7c260a84cc8daae0113fbbf30f5a9e7ca921ee3e))
* **deps:** update dependency todomvc-app-css to v2.4.2 ([#17](https://github.com/liwijs/liwi/issues/17)) ([ad86c2a](https://github.com/liwijs/liwi/commit/ad86c2a43f64031ffd1a443286090eb3b86d722b))
* update alp-rollup-plugin-config ([f7a3d39](https://github.com/liwijs/liwi/commit/f7a3d398749000f14006773fac8f4ef52a9b0b11))


### Features

* **deps:** update dependency mongodb to v4 ([#22](https://github.com/liwijs/liwi/issues/22)) ([cdf9204](https://github.com/liwijs/liwi/commit/cdf920461156e5dd6dceaf5bf26b24c206385634))
* **deps:** update dependency next to v12.1.0 [security] ([#20](https://github.com/liwijs/liwi/issues/20)) ([e8318e1](https://github.com/liwijs/liwi/commit/e8318e10589d03de641e29d924edeff116e9d21f))
* refactor and use node 14 ([101c861](https://github.com/liwijs/liwi/commit/101c861063420fc5a83ff5a45322b9529962dcc2))


### BREAKING CHANGES

* **deps:** cursor.count() is removed and replaced by store.count() 
* requires node 14





## [8.3.1](https://github.com/liwijs/liwi/compare/v8.3.0...v8.3.1) (2021-11-28)


### Bug Fixes

* **liwi-mongo:** fix mingoQuery for MongoQuerySingleItem ([34c240f](https://github.com/liwijs/liwi/commit/34c240f5b8c2a4fa3f3190d634acb92ab5ea563c))





# [8.3.0](https://github.com/liwijs/liwi/compare/v8.2.1...v8.3.0) (2021-11-22)


### Bug Fixes

* update pob-babel and bring back webpack 4 compat ([135caf3](https://github.com/liwijs/liwi/commit/135caf3c2d1693ae39d33e7527f16392720865a5))


### Features

* **react-liwi:** compare on initial if already have state to prevent overriding in progress changes in forms ([356bc89](https://github.com/liwijs/liwi/commit/356bc89c133d6faea4618946423a13951ede6ebd))





## [8.2.1](https://github.com/liwijs/liwi/compare/v8.2.0...v8.2.1) (2021-06-29)


### Bug Fixes

* log internal server error ([a2c176c](https://github.com/liwijs/liwi/commit/a2c176c0c13eb796c8bc5f968fa65adb9a132f32))





# [8.2.0](https://github.com/liwijs/liwi/compare/v8.1.5...v8.2.0) (2021-04-10)


### Features

* **liwi-resources-websocket-client:** add third argument for websocket in react-native ([8bff87a](https://github.com/liwijs/liwi/commit/8bff87aa300024b67deb20a7ed2c61907584cfee))





## [8.1.5](https://github.com/liwijs/liwi/compare/v8.1.4...v8.1.5) (2021-03-29)


### Bug Fixes

* **react-liwi:** export ResourcesServerError ([41d5c13](https://github.com/liwijs/liwi/commit/41d5c13d8134c2165d8dd289310b1aa0ec686b45))





## [8.1.4](https://github.com/liwijs/liwi/compare/v8.1.3...v8.1.4) (2021-03-29)


### Bug Fixes

* **react-liwi:** improve typings, error can be ResourcesServerError ([26fa437](https://github.com/liwijs/liwi/commit/26fa437547c9826f0db19cc233a8d46161e7d9a7))





## [8.1.3](https://github.com/liwijs/liwi/compare/v8.1.2...v8.1.3) (2021-03-29)


### Bug Fixes

* **liwi-resources-websocket-client:** only use console.error on error if onError not provided ([6d65a6b](https://github.com/liwijs/liwi/commit/6d65a6b44013785d18f882630c13637501b7ecc6))





## [8.1.2](https://github.com/liwijs/liwi/compare/v8.1.1...v8.1.2) (2021-03-29)


### Bug Fixes

* **liwi-resources:** build for browsers ([3c32141](https://github.com/liwijs/liwi/commit/3c32141695f6f7e355786d9cb37c2f6ba0aca48a))





## [8.1.1](https://github.com/liwijs/liwi/compare/v8.1.0...v8.1.1) (2021-03-28)


### Bug Fixes

* mongo import for esm ([4fd2251](https://github.com/liwijs/liwi/commit/4fd2251c25b6e3df01d4ab82fe3e2da868acbdd9))





# [8.1.0](https://github.com/liwijs/liwi/compare/v8.0.4...v8.1.0) (2021-03-28)


### Bug Fixes

* remove unused @types/socket.io dependency ([af453d1](https://github.com/liwijs/liwi/commit/af453d1bd7d66ce1337e7f4e5ae1b2b7a04174a8))
* remove unused deep-equal dependency ([dbd4d62](https://github.com/liwijs/liwi/commit/dbd4d62143fee4c4981c5ca28991bcd30b94603c))
* update optional dependencies in liwi-resources-websocket-server ([3b3ab8f](https://github.com/liwijs/liwi/commit/3b3ab8f04020d60727e0be78474e33c76497a1ee))


### Features

* update mingo ([dbda259](https://github.com/liwijs/liwi/commit/dbda259098aafc688fa9c3d4f1ef8355a1832c98))
* **react-liwi:** allow react 17 ([cc2cbe4](https://github.com/liwijs/liwi/commit/cc2cbe47fb5a19dad0da70a8e844d4cb5e4cf539))
* update mongo ([20b7a59](https://github.com/liwijs/liwi/commit/20b7a59500c355d45ae490a4032a42a4bc13ecd7))
* update nightingale ([ede1ef6](https://github.com/liwijs/liwi/commit/ede1ef66f10f3b631bcbf09687faed56e62f47ca))
* update ws ([d57d8fe](https://github.com/liwijs/liwi/commit/d57d8fe7cb6ab1f89db0c23131d6f026afbe848f))





## [8.0.4](https://github.com/liwijs/liwi/compare/v8.0.3...v8.0.4) (2021-01-18)


### Bug Fixes

* update pob-babel for better support ([4cb684e](https://github.com/liwijs/liwi/commit/4cb684e2abc21ffb0d8b0e738da36c0f3c5ea1c2))





## [8.0.3](https://github.com/liwijs/liwi/compare/v8.0.2...v8.0.3) (2021-01-18)


### Bug Fixes

* import browser path ([e42b0b8](https://github.com/liwijs/liwi/commit/e42b0b817f6c4ce56a09f398b58aadfc520ee0c9))





## [8.0.2](https://github.com/liwijs/liwi/compare/v8.0.1...v8.0.2) (2021-01-18)


### Bug Fixes

* bring back support for webpack 4 ([f2b5583](https://github.com/liwijs/liwi/commit/f2b5583ebfb21c66673b269ed22a9d4a9ffc126d))





## [8.0.1](https://github.com/liwijs/liwi/compare/v8.0.0...v8.0.1) (2021-01-10)


### Bug Fixes

* setOnInsertPartialObject type ([310d869](https://github.com/liwijs/liwi/commit/310d86990080668344a5c71c014bf6507111315f))





# [8.0.0](https://github.com/liwijs/liwi/compare/v7.6.2...v8.0.0) (2021-01-10)


### Code Refactoring

* update dev dependencies ([#12](https://github.com/liwijs/liwi/issues/12)) ([c75bfdc](https://github.com/liwijs/liwi/commit/c75bfdcbe5404f5e09679a336edf4bf12b95c57a))


### Features

* add setOnInsertPartialObject in upsertOne and upsertOneWithInfo ([bf5b844](https://github.com/liwijs/liwi/commit/bf5b844e87a1e848eedfa7151709a4e89f5d99b9))


### BREAKING CHANGES

* drop node 10





## [7.6.2](https://github.com/liwijs/liwi/compare/v7.6.1...v7.6.2) (2020-11-13)


### Bug Fixes

* log message in debug ([89ef949](https://github.com/liwijs/liwi/commit/89ef949))





## [7.6.1](https://github.com/liwijs/liwi/compare/v7.6.0...v7.6.1) (2020-11-13)


### Bug Fixes

* wss protocol detection ([b487ce6](https://github.com/liwijs/liwi/commit/b487ce6))





# [7.6.0](https://github.com/liwijs/liwi/compare/v7.5.0...v7.6.0) (2020-10-05)


### Bug Fixes

* better AppErrorCatcher ([f53c554](https://github.com/liwijs/liwi/commit/f53c554))


### Features

* add skip ([6764e7b](https://github.com/liwijs/liwi/commit/6764e7b))





# [7.5.0](https://github.com/liwijs/liwi/compare/v7.4.3...v7.5.0) (2020-08-15)


### Features

* dont try to reconnect when visibility is hidden ([2705a33](https://github.com/liwijs/liwi/commit/2705a33))





## [7.4.3](https://github.com/liwijs/liwi/compare/v7.4.2...v7.4.3) (2020-08-14)


### Bug Fixes

* return result ([ec33b4e](https://github.com/liwijs/liwi/commit/ec33b4e))





## [7.4.2](https://github.com/liwijs/liwi/compare/v7.4.1...v7.4.2) (2020-08-14)


### Bug Fixes

* beter handle no result in MongoQuerySingleItem ([6b13448](https://github.com/liwijs/liwi/commit/6b13448))
* remove console.log ([9c0aa56](https://github.com/liwijs/liwi/commit/9c0aa56))





## [7.4.1](https://github.com/liwijs/liwi/compare/v7.4.0...v7.4.1) (2020-08-14)


### Bug Fixes

* handle event subscribe:close without id ([1a82247](https://github.com/liwijs/liwi/commit/1a82247))





# [7.4.0](https://github.com/liwijs/liwi/compare/v7.3.0...v7.4.0) (2020-08-09)


### Bug Fixes

* remove console.log ([6ee5ef5](https://github.com/liwijs/liwi/commit/6ee5ef5))


### Features

* prepare liwi-resources-direct-client ([8b3f681](https://github.com/liwijs/liwi/commit/8b3f681))





# [7.3.0](https://github.com/liwijs/liwi/compare/v7.2.3...v7.3.0) (2020-08-08)


### Features

* add default url ([3006b30](https://github.com/liwijs/liwi/commit/3006b30))





## [7.2.3](https://github.com/liwijs/liwi/compare/v7.2.2...v7.2.3) (2020-08-08)


### Bug Fixes

* better type ServiceInterface ([34b57b1](https://github.com/liwijs/liwi/commit/34b57b1))





## [7.2.2](https://github.com/liwijs/liwi/compare/v7.2.1...v7.2.2) (2020-08-08)


### Bug Fixes

* missing undefined in ServiceQuery ([b88ca69](https://github.com/liwijs/liwi/commit/b88ca69))





## [7.2.1](https://github.com/liwijs/liwi/compare/v7.2.0...v7.2.1) (2020-08-08)


### Bug Fixes

* params type ([bf54f7b](https://github.com/liwijs/liwi/commit/bf54f7b))





# [7.2.0](https://github.com/liwijs/liwi/compare/v7.1.0...v7.2.0) (2020-08-08)


### Bug Fixes

* set ConnectedUser to unknown if not specified ([1b8773a](https://github.com/liwijs/liwi/commit/1b8773a))


### Features

* allow to not pass params when undefined ([6a6bf76](https://github.com/liwijs/liwi/commit/6a6bf76))





# [7.1.0](https://github.com/liwijs/liwi/compare/v7.0.0...v7.1.0) (2020-08-08)


### Features

* getAuthenticatedUser can return a promise ([ab06bf3](https://github.com/liwijs/liwi/commit/ab06bf3))





# [7.0.0](https://github.com/liwijs/liwi/compare/v0.18.8...v7.0.0) (2020-08-08)


### Bug Fixes

* add missing document.removeEventListener for visibilitychange ([3277950](https://github.com/liwijs/liwi/commit/3277950))
* add resultRef, state is always initial ([e91b291](https://github.com/liwijs/liwi/commit/e91b291))
* allow QueryDescription to have void param ([0c9a894](https://github.com/liwijs/liwi/commit/0c9a894))
* build ([ac2ee64](https://github.com/liwijs/liwi/commit/ac2ee64))
* build ([d286aff](https://github.com/liwijs/liwi/commit/d286aff))
* debug log init ([fc28efb](https://github.com/liwijs/liwi/commit/fc28efb))
* dont subscribe on initial render if document is not visible ([db507de](https://github.com/liwijs/liwi/commit/db507de))
* encode operation result ([c838894](https://github.com/liwijs/liwi/commit/c838894))
* eslint error ([206b1b5](https://github.com/liwijs/liwi/commit/206b1b5))
* export createMongoResourcesWebsocketClient ([dc5cf66](https://github.com/liwijs/liwi/commit/dc5cf66))
* exported ServiceResource second arg is optional ([d6c282f](https://github.com/liwijs/liwi/commit/d6c282f))
* fixes ([482c388](https://github.com/liwijs/liwi/commit/482c388))
* improve ServiceResource definitions ([92a1c3b](https://github.com/liwijs/liwi/commit/92a1c3b))
* mingoQuery without criteria ([fe78dd2](https://github.com/liwijs/liwi/commit/fe78dd2))
* missing callback in unsubscribe ([8ff0fb3](https://github.com/liwijs/liwi/commit/8ff0fb3))
* missing declaration files ([aa5021f](https://github.com/liwijs/liwi/commit/aa5021f))
* queries and operations should be a record, not an array ([b0a89da](https://github.com/liwijs/liwi/commit/b0a89da))
* queries definition ([ad3cfa4](https://github.com/liwijs/liwi/commit/ad3cfa4))
* remove obsolete dependency ([ce61569](https://github.com/liwijs/liwi/commit/ce61569))
* remove unused peerDependency prop-types ([2aff4f4](https://github.com/liwijs/liwi/commit/2aff4f4))
* rename Query to ClientQuery ([e330a62](https://github.com/liwijs/liwi/commit/e330a62))
* resubscribing did not work correctly ([68b485a](https://github.com/liwijs/liwi/commit/68b485a))
* send value array ([7f012c2](https://github.com/liwijs/liwi/commit/7f012c2))
* subscribe-store param createQuery ([74f4fd7](https://github.com/liwijs/liwi/commit/74f4fd7))
* support namespace ([e677afc](https://github.com/liwijs/liwi/commit/e677afc))
* typescript def queries allow Promise ([60a893e](https://github.com/liwijs/liwi/commit/60a893e))
* useResource without subscribing ([645421d](https://github.com/liwijs/liwi/commit/645421d))
* **liwi-mongo:** replaceone ([eea4324](https://github.com/liwijs/liwi/commit/eea4324))
* unsubcribe call with this ([9826048](https://github.com/liwijs/liwi/commit/9826048))
* unsubscribe and add subscribeHook ([d6e3d5a](https://github.com/liwijs/liwi/commit/d6e3d5a))
* use partial for $set and $setOnInsert ([2e02952](https://github.com/liwijs/liwi/commit/2e02952))


### Code Refactoring

* **react-liwi:** remove react components ([6ece729](https://github.com/liwijs/liwi/commit/6ece729))
* typescript ([5ec81a1](https://github.com/liwijs/liwi/commit/5ec81a1))
* use lerna ([88b2a3c](https://github.com/liwijs/liwi/commit/88b2a3c))


### Features

* add and export mongo types ([aec6dba](https://github.com/liwijs/liwi/commit/aec6dba))
* add connected user ([c43685c](https://github.com/liwijs/liwi/commit/c43685c))
* add criteria un findByKey and deleteByKey ([2adfaba](https://github.com/liwijs/liwi/commit/2adfaba))
* add hooks ([906c820](https://github.com/liwijs/liwi/commit/906c820))
* add liwi-resources-void-client ([5cff2e4](https://github.com/liwijs/liwi/commit/5cff2e4))
* add log when unsubscribed due to timeout ([4d8fff6](https://github.com/liwijs/liwi/commit/4d8fff6))
* add more info in logger ([76bacf1](https://github.com/liwijs/liwi/commit/76bacf1))
* add Operations default in ServiceResource ([d60fb38](https://github.com/liwijs/liwi/commit/d60fb38))
* add optional critieria in partialUpdateByKey ([6bd5578](https://github.com/liwijs/liwi/commit/6bd5578))
* add timeout and visibilitychange in FindAndSubscribe ([ea8ce5e](https://github.com/liwijs/liwi/commit/ea8ce5e))
* add transformer ([76861ae](https://github.com/liwijs/liwi/commit/76861ae))
* add transformer in createQuery ([1826413](https://github.com/liwijs/liwi/commit/1826413))
* allow client createQuery to not pass params ([be9e4a2](https://github.com/liwijs/liwi/commit/be9e4a2))
* allow params in createQuery ([d674556](https://github.com/liwijs/liwi/commit/d674556))
* allow query to be returned with a promise ([902944c](https://github.com/liwijs/liwi/commit/902944c))
* allow ResourcesClientService to have optional second generic ([c0a8d8c](https://github.com/liwijs/liwi/commit/c0a8d8c))
* allow to get params in subscribe hooks ([49e40cf](https://github.com/liwijs/liwi/commit/49e40cf))
* big refactor ([#5](https://github.com/liwijs/liwi/issues/5)) ([a4629c4](https://github.com/liwijs/liwi/commit/a4629c4))
* drop node 8 ([2fb6528](https://github.com/liwijs/liwi/commit/2fb6528))
* mongo 3 ([b9bfaa4](https://github.com/liwijs/liwi/commit/b9bfaa4))
* update deps and improve typescript dev ([b42eefb](https://github.com/liwijs/liwi/commit/b42eefb))
* **liwi-subscribe-store:** implement deleteMany ([a7cb28e](https://github.com/liwijs/liwi/commit/a7cb28e))
* **liwi-subscribe-store:** implement partialUpdateMany ([b15b003](https://github.com/liwijs/liwi/commit/b15b003))
* **react-liwi:** add subscribeOptions in useResource ([187fdda](https://github.com/liwijs/liwi/commit/187fdda))
* createMongoResourcesWebsocketClient ([3f0f3e7](https://github.com/liwijs/liwi/commit/3f0f3e7))
* export type Update in liwi-store ([1c051c8](https://github.com/liwijs/liwi/commit/1c051c8))
* liwi-subscribe-store ([53b18a3](https://github.com/liwijs/liwi/commit/53b18a3))
* pass object to ResourcesServerService instead of 2 param ([e3f3225](https://github.com/liwijs/liwi/commit/e3f3225))
* queries as fn with result ([1a1abcb](https://github.com/liwijs/liwi/commit/1a1abcb))
* queryInfo in applyChanges and liwi-mongo ([ecfdc3f](https://github.com/liwijs/liwi/commit/ecfdc3f))
* rename createResourceClient to createResourceClientService ([0118f85](https://github.com/liwijs/liwi/commit/0118f85))
* replace query by createQuery ([1561da0](https://github.com/liwijs/liwi/commit/1561da0))
* resource operations ([9ddd3b7](https://github.com/liwijs/liwi/commit/9ddd3b7))
* split liwi-resources into server and client ([df73bf9](https://github.com/liwijs/liwi/commit/df73bf9))


### BREAKING CHANGES

* drop node 8
* **react-liwi:** use hooks instead of react components
* added Transformer, query model is now value in query description
* query prop no longer exists, replaced by createQuery
* replace new ResourcesServerService(map1, map2) by new ResourcesServerService({serviceResources:map1, cursorResources:map2})
* multiple typescript typings change
* major rewrite in typescript
* liwi package splitted
