# Changelog - BuhBot

All notable changes to BuhBot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.18.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.17.0...buhbot-v0.18.0) (2026-02-22)


### Features

* append-only message store (buh-kwi) ([#197](https://github.com/maslennikov-ig/BuhBot/issues/197)) ([b1533f4](https://github.com/maslennikov-ig/BuhBot/commit/b1533f42091e4940403042aaab8a5d32beebc964))

## [0.17.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.16.0...buhbot-v0.17.0) (2026-02-21)


### Features

* **ci:** switch to feature branch + pr workflow (buh-h7d) ([#194](https://github.com/maslennikov-ig/BuhBot/issues/194)) ([958a932](https://github.com/maslennikov-ig/BuhBot/commit/958a93216baa47414b23b57e33bb716709cd5c78))

## [0.16.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.15.1...buhbot-v0.16.0) (2026-02-21)


### Features

* **backend:** switch classifier to mimo-v2-flash (buh-ti4) ([3daf71a](https://github.com/maslennikov-ig/BuhBot/commit/3daf71a6fa2fe5f32af3cf4a18d7da7f1b78df13))


### Bug Fixes

* **backend:** make empty openrouter response retryable (buh-5f4) ([e48bc88](https://github.com/maslennikov-ig/BuhBot/commit/e48bc887c5cebf76f8029c1cd52e8102de77185b))

## [0.15.1](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.15.0...buhbot-v0.15.1) (2026-02-21)


### Bug Fixes

* **backend:** preserve winston symbol keys in bigint format ([aa78ca4](https://github.com/maslennikov-ig/BuhBot/commit/aa78ca4270443b589d161fc497b8fd7faebe394a))

## [0.15.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.8...buhbot-v0.15.0) (2026-02-21)


### Features

* **backend:** add metadata sanitization for errors (gh-190) ([aa58738](https://github.com/maslennikov-ig/BuhBot/commit/aa587381fc2ceb7776c3784344feebd0f5390e2f))


### Bug Fixes

* **backend:** elevate error_logs read auth to manager (gh-190) ([529638d](https://github.com/maslennikov-ig/BuhBot/commit/529638d57c895a50e23dc1158d6d2e1d293efd67))

## [0.14.8](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.7...buhbot-v0.14.8) (2026-02-21)


### Bug Fixes

* **backend:** harden migration and chat list (gh-185) ([8c1ece2](https://github.com/maslennikov-ig/BuhBot/commit/8c1ece24e0b150ae96b8e53ff18a8c586fa9a3f0))

## [0.14.7](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.6...buhbot-v0.14.7) (2026-02-21)


### Bug Fixes

* **backend:** atomic migration and chat filtering (gh-185) ([7dc8eed](https://github.com/maslennikov-ig/BuhBot/commit/7dc8eedbd94eb3ca051221114ef986be68c6be8e))

## [0.14.6](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.5...buhbot-v0.14.6) (2026-02-21)


### Bug Fixes

* **backend:** add bigint conversions, disable error_logs rls ([baf9cb3](https://github.com/maslennikov-ig/BuhBot/commit/baf9cb361d0d59147669f9bd29cd71247c58ce4e)), closes [#184](https://github.com/maslennikov-ig/BuhBot/issues/184) [#186](https://github.com/maslennikov-ig/BuhBot/issues/186)
* **backend:** resolve missing chat messages (gh-185) ([56aa3ba](https://github.com/maslennikov-ig/BuhBot/commit/56aa3ba0ed5a019317614b0f629d5459b953a142))

## [0.14.5](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.4...buhbot-v0.14.5) (2026-02-20)


### Bug Fixes

* **backend:** add telegram validation timeout, centralize urls ([c2c00f5](https://github.com/maslennikov-ig/BuhBot/commit/c2c00f54c80c4bd7ac828505ca5896f06842cd3a))
* **backend:** address code review findings ([35f1c20](https://github.com/maslennikov-ig/BuhBot/commit/35f1c2044be789752a7d47f78374e8db266523c2))
* **ci:** add missing frontend build args (gh-172, gh-173) ([9c37739](https://github.com/maslennikov-ig/BuhBot/commit/9c3773985a6e24ad08820243951251e458328669))
* **config:** address remaining code review findings ([3c3ace6](https://github.com/maslennikov-ig/BuhBot/commit/3c3ace60bd5a2a39deb085ce44d6dbb92a63a3f0))
* **dev-mode:** unify dev mode exports and mock user ids ([5e12f93](https://github.com/maslennikov-ig/BuhBot/commit/5e12f93d958406c2a6e0e563c5ce4383666fda44))
* **release:** eliminate sigpipe in changelog update functions ([8459f54](https://github.com/maslennikov-ig/BuhBot/commit/8459f5487c2045adcaa256b8f61e39bf52f2c7d8))
* **release:** support release please tag format in release script ([1b8304f](https://github.com/maslennikov-ig/BuhBot/commit/1b8304f604429af418a4dc06933e71fb5ebd4833))

## [0.14.4](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.3...buhbot-v0.14.4) (2026-02-17)


### Bug Fixes

* **classifier:** use clarification as default for low confidence ([022285a](https://github.com/maslennikov-ig/BuhBot/commit/022285a81c98a6ae9b4bf315fef02c77435a2385))
* **message-handler:** include answered status in dedup check ([970ee99](https://github.com/maslennikov-ig/BuhBot/commit/970ee993fe473735f1d70451414ebe564f082d10))

## [0.14.3](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.2...buhbot-v0.14.3) (2026-02-17)


### Bug Fixes

* **config:** add bot name env var, fix log level and redis policy ([c338a37](https://github.com/maslennikov-ig/BuhBot/commit/c338a3778553620a3c589e02c664171f7820fd7c))

## [0.14.2](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.1...buhbot-v0.14.2) (2026-02-17)


### Bug Fixes

* **backend:** address code review findings for p2 batch ([5a580f4](https://github.com/maslennikov-ig/BuhBot/commit/5a580f4955f884f5bac9f3c302511e9f21cb7867))
* **backend:** address p2 bugs from github issues batch ([eadac18](https://github.com/maslennikov-ig/BuhBot/commit/eadac189d086f9c994488b518876cc87d23e459e))
* **backend:** address p2-p3 bugs and schema improvements ([bae6114](https://github.com/maslennikov-ig/BuhBot/commit/bae61144edeb24fa7351cdba6b1e5b73c492caea))
* **backend:** address remaining 9 p2 bugs from github issues ([1abedce](https://github.com/maslennikov-ig/BuhBot/commit/1abedcef1802549fccf4a598e82e42a1c548d724))
* **backend:** address remaining p2 bugs from github issues ([0c0ba83](https://github.com/maslennikov-ig/BuhBot/commit/0c0ba838e0e96c52f5c6966f4bd2cb0d708313b0))
* **backend:** reduce data retention batch size for transaction safety ([9fb5da2](https://github.com/maslennikov-ig/BuhBot/commit/9fb5da26eb8a809efc058abfb2c295520bd3c646))
* **backend:** remove sslmode from url validation ([3cbbf45](https://github.com/maslennikov-ig/BuhBot/commit/3cbbf45119ae55627835220d0e65fa45f2e16f7b))
* **backend:** resolve ci failures in format and type-check ([b443db6](https://github.com/maslennikov-ig/BuhBot/commit/b443db66b6eedcace5b127d59482dfc10e55c59c))
* **ci:** replace rsync with git-based vds sync ([56d71e7](https://github.com/maslennikov-ig/BuhBot/commit/56d71e778b3fc004a0a48c07ceb3d420c374c99a))
* **security:** address 6 p1 security and stability bugs ([195187f](https://github.com/maslennikov-ig/BuhBot/commit/195187f2719fcf1fe7ae27d08ceb801911350045))
* **security:** address code review findings for p1 fixes ([b3c1eed](https://github.com/maslennikov-ig/BuhBot/commit/b3c1eed5cfa036ba215ddde9b7cac6da14a2d3c1))
* **security:** address critical security and data integrity bugs ([a55d148](https://github.com/maslennikov-ig/BuhBot/commit/a55d1481a7405f0f8aff55fc44c5868bcec2faf8))
* **security:** complete code review recommendations ([28417da](https://github.com/maslennikov-ig/BuhBot/commit/28417da64f99e54e171bae27f8d43c94a5b4e552))

## [0.14.1](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.14.0...buhbot-v0.14.1) (2026-02-16)


### Bug Fixes

* **infra:** fix jaeger volume permissions in deploy scripts ([c7b7599](https://github.com/maslennikov-ig/BuhBot/commit/c7b7599e73f59c5d7b6ec030fc2a8751bfaef1e9))
* resolve ci failures and fix lint-staged monorepo config ([ab81d34](https://github.com/maslennikov-ig/BuhBot/commit/ab81d341ffb2ddcd04afba28677bc883041f4e04))
* sync backend package-lock.json and format lintstagedrc ([06dbd13](https://github.com/maslennikov-ig/BuhBot/commit/06dbd13e88fe40c360ec6c9921f6c20873add006))

## [0.14.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.13.0...buhbot-v0.14.0) (2026-02-16)


### Features

* **frontend:** add AI Classification and Data Retention settings tabs ([0724394](https://github.com/maslennikov-ig/BuhBot/commit/07243946884e330c1192b32b79f370418a53949a))
* implement reopened issues gh-69 through gh-77 ([f4df844](https://github.com/maslennikov-ig/BuhBot/commit/f4df8447295058fd52a7d1504b54e347bb1b5c7d))


### Bug Fixes

* address code review findings for gh-69..gh-77 ([8e82009](https://github.com/maslennikov-ig/BuhBot/commit/8e820090808dc1651549d4854202bb8a527d2be5))

## [0.13.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.12.0...buhbot-v0.13.0) (2026-02-14)


### Features

* add classifier feedback loop and thread tracking (gh-73, gh-75) ([eddab36](https://github.com/maslennikov-ig/BuhBot/commit/eddab36daa2221336288ced21fb8a087d3a9d2be))
* add OpenTelemetry distributed tracing foundation (gh-77) ([85f2b2e](https://github.com/maslennikov-ig/BuhBot/commit/85f2b2eb2cdfc5df85359c2464269c381cf20561))
* add VIP client tier with tier-based SLA thresholds (gh-76) ([b201b9b](https://github.com/maslennikov-ig/BuhBot/commit/b201b9b6fcf61c0fffcbe137d0a9023d2e6295a6))
* implement critical backend features (gh-66, gh-67, gh-68, gh-69) ([1ae7afd](https://github.com/maslennikov-ig/BuhBot/commit/1ae7afd35832290e6feea658d4aed2d8ba2ff591))
* remove legacy accountantUsername field and add ConfigService (gh-72, gh-74) ([3e21e1a](https://github.com/maslennikov-ig/BuhBot/commit/3e21e1a7f9e6e4c22d4c45db48b0899a9a2a35f5))
* **sla:** add request history audit trail (gh-70) ([e15ec30](https://github.com/maslennikov-ig/BuhBot/commit/e15ec30f1c8177194b99ac4a79cdc3e3cccd1d48))


### Bug Fixes

* resolve 16 GitHub issues — data bugs, security, UX, a11y ([eef61d6](https://github.com/maslennikov-ig/BuhBot/commit/eef61d6c6ee1ee8fe2ee40ec7bdec31671c9a825))
* update pnpm-lock.yaml and fix Prettier formatting (buh-bbt) ([529e7bf](https://github.com/maslennikov-ig/BuhBot/commit/529e7bf1eee8a0fa69e39611ccf97fe3427344b9))


### Performance Improvements

* **analytics:** optimize getDashboard N+1 queries (gh-71) ([4f1eb71](https://github.com/maslennikov-ig/BuhBot/commit/4f1eb71d8e9faca2c6bc86f9ef0256527b0134c3))

## [0.12.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.11.2...buhbot-v0.12.0) (2026-02-12)


### Features

* validate accountant [@username](https://github.com/username) against DB + fix slaEnabled default ([f384ee8](https://github.com/maslennikov-ig/BuhBot/commit/f384ee8b506e170c12e36fb6bef8ba68f1de65ab))


### Bug Fixes

* address code review findings — logger, SLA compliance accuracy ([98bb4e9](https://github.com/maslennikov-ig/BuhBot/commit/98bb4e9342fa0e5664b718a422c4bdefa645b3be))
* implement remaining code review recommendations (buh-6ku, buh-d6f, buh-hsv) ([9101ba9](https://github.com/maslennikov-ig/BuhBot/commit/9101ba9bd0667dae79619f9eb0d2b5668c171ad9))
* improve SLA validation safety + add defensive notifyInChatOnBreach fallback + tests ([a06622d](https://github.com/maslennikov-ig/BuhBot/commit/a06622dc33b1599ecf15ec6dcc1b0e9328176949))
* resolve 3 chat settings and admin panel bugs ([#37](https://github.com/maslennikov-ig/BuhBot/issues/37), [#38](https://github.com/maslennikov-ig/BuhBot/issues/38), [#39](https://github.com/maslennikov-ig/BuhBot/issues/39)) ([26d5975](https://github.com/maslennikov-ig/BuhBot/commit/26d5975ab986266b1dc025e29a60e41f026f9f88))
* resolve 4 GitHub issues — alert 500, SLA stats, UI/UX, blank pages ([2562085](https://github.com/maslennikov-ig/BuhBot/commit/2562085d50407194cd52650fc5b53cf72281b805))

## [0.11.2](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.11.1...buhbot-v0.11.2) (2026-02-11)


### Bug Fixes

* **sla:** fix analytics wrong field + align slaEnabled schema default ([26623ba](https://github.com/maslennikov-ig/BuhBot/commit/26623bae26f536842afce5d436314fae4cb8c150))
* **sla:** resolve 4 SLA bugs — message drop, notification leak, migration duplicate, wrong field ([8cf2a82](https://github.com/maslennikov-ig/BuhBot/commit/8cf2a8252be029794dfad7d3bfc516fa6aab7d7f))

## [0.11.1](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.11.0...buhbot-v0.11.1) (2026-02-11)


### Bug Fixes

* **infra:** bind Docker ports to 127.0.0.1 to prevent internet exposure ([c5c1a3e](https://github.com/maslennikov-ig/BuhBot/commit/c5c1a3e45c65db1f05e54e4397a9a8a4edcb854b))

## [0.11.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.10.0...buhbot-v0.11.0) (2026-02-04)


### Features

* **.claude/skills/systematic-debugging/condition-based-waiting-example.ts:** add 17 source file(s), add 4 agent(s), +7 more ([7cc7cdc](https://github.com/maslennikov-ig/BuhBot/commit/7cc7cdce09f1f10e83ba1336bdeaf160bcdc5cf7))
* **007:** Implement Admin CRUD Pages ([1cd27c7](https://github.com/maslennikov-ig/BuhBot/commit/1cd27c742c5da1f44d2619e226fcc78a6215fe14))
* **accountants:** add multiple accountant usernames support ([8587966](https://github.com/maslennikov-ig/BuhBot/commit/858796602617c54e65f577bb0b938e4c0d89587b))
* add 1 skill(s), update docs ([40c751a](https://github.com/maslennikov-ig/BuhBot/commit/40c751aec07c46aae9224bab6d331822502eb732))
* add chat delete functionality ([aa16d15](https://github.com/maslennikov-ig/BuhBot/commit/aa16d15770a0443779b4d42e581a8d3a501ae43e))
* add DEV MODE for local development without Supabase ([402e5f1](https://github.com/maslennikov-ig/BuhBot/commit/402e5f1502284fe35c01b0a3715efed56bd2f01f))
* add DEV MODE for local development without Supabase ([a56d9a7](https://github.com/maslennikov-ig/BuhBot/commit/a56d9a7bde9f06be3bc495add9ed13613d52780c))
* add invite_link to Chat model for universal 'Open chat' button support (buh-8tp) ([fbf8510](https://github.com/maslennikov-ig/BuhBot/commit/fbf8510e6bcb1fce2899581c7e86fec97bc3cd19))
* add password visibility toggle and fix light mode visibility in login ([9a6cf15](https://github.com/maslennikov-ig/BuhBot/commit/9a6cf15a5e864f3de7dcdc67ef5b2ac0baaa1c75))
* add Violations and Help menu items, create Help page ([162f266](https://github.com/maslennikov-ig/BuhBot/commit/162f2669b4bbe50dc16974d3ecac2c90154bf0ca))
* **agents:** add nextjs-ui-designer agent ([04fd327](https://github.com/maslennikov-ig/BuhBot/commit/04fd327c29286b4d9feab15f9806a66d5644d064))
* **agents:** add supabase-fixer agent ([7ab2cfe](https://github.com/maslennikov-ig/BuhBot/commit/7ab2cfe94d2236ae5ee1e1bf849465339ec9b079))
* **agents:** create 8 infrastructure worker agents for BuhBot deployment ([5b01434](https://github.com/maslennikov-ig/BuhBot/commit/5b0143475bf7a4b488f25d6589531d61a0c3980d))
* **analytics:** Add response time analytics page and table sorting ([1f5698a](https://github.com/maslennikov-ig/BuhBot/commit/1f5698a2bdd4b560a2aea5fc1a150b4d78c9b55e))
* **api:** add accountantUsernames array support to chats router ([048bf1c](https://github.com/maslennikov-ig/BuhBot/commit/048bf1ce537c2715b5a92f45404b6f771e5af8b1))
* **api:** add tRPC logs router for error logs management (buh-zdc) ([5e3be7e](https://github.com/maslennikov-ig/BuhBot/commit/5e3be7eb70c558ae498ab0e52a772f1785e3e173))
* **auth:** Add user invitation flow with Supabase Auth ([66b8a4b](https://github.com/maslennikov-ig/BuhBot/commit/66b8a4bfb7f428066052fb1138078f1007b32931))
* **backend:** complete Phase 3 - Supabase database setup ([142ca9f](https://github.com/maslennikov-ig/BuhBot/commit/142ca9f79d02e81e854ce3199ee9b9b1577fe4c7))
* **backend:** integrate tRPC Express adapter ([a6c0d39](https://github.com/maslennikov-ig/BuhBot/commit/a6c0d399ad3553c0152e2201b2f94872dd6c6f78))
* **bot:** add /help command handler ([36485d3](https://github.com/maslennikov-ig/BuhBot/commit/36485d315df136c2411a75ccdd744303df74cd0c))
* **branding:** Add light theme logo + increase Hero text size ([470e29b](https://github.com/maslennikov-ig/BuhBot/commit/470e29b1e14449fb13f5112006c03d786283a8c6))
* **branding:** Add logo image to Header, Footer, Auth pages ([63e51f0](https://github.com/maslennikov-ig/BuhBot/commit/63e51f0ffebb1edfe39386bfed7b715ffe32fe7b))
* **ci:** add Telegram notification on CI failure ([585f6cd](https://github.com/maslennikov-ig/BuhBot/commit/585f6cda64b312ed1b2c65ee67050c092ce72bac))
* **classifier:** add metrics, circuit breaker, and message filtering ([e152d29](https://github.com/maslennikov-ig/BuhBot/commit/e152d29ff12d1a267824dace98031f022a69d2f2))
* **classifier:** improve Russian classification prompt with few-shot examples ([dd57b75](https://github.com/maslennikov-ig/BuhBot/commit/dd57b750c5a9d6b5ca46dba0d177fd4c3cdb7aa4))
* **database:** add ErrorLog model for centralized error tracking (buh-oyj) ([7830439](https://github.com/maslennikov-ig/BuhBot/commit/7830439e3d2023f2e1a250e652b5b7beffb3aaa9))
* **deploy:** add pre-flight checks for dependencies and ports ([b78cac2](https://github.com/maslennikov-ig/BuhBot/commit/b78cac28040fd4734720139b46715c324dd31d73))
* **deps:** migrate Prisma 5.22 to 7.0 ([785e16e](https://github.com/maslennikov-ig/BuhBot/commit/785e16e9849b141d9494d27427a6f40dc19d7554))
* **dev-mode:** implement DEV MODE for local development without Supabase ([23250fa](https://github.com/maslennikov-ig/BuhBot/commit/23250fa151b00dbe5f10a032c836e166936fc689))
* **frontend:** add action buttons for requests management ([8fcb1c2](https://github.com/maslennikov-ig/BuhBot/commit/8fcb1c29ecc94a0958bfada2fa39260fa752c561))
* **frontend:** add complete logs/errors UI with pages and components (buh-mgs, buh-brr) ([3fe4d8e](https://github.com/maslennikov-ig/BuhBot/commit/3fe4d8e8a90864fc2debd3a0e63d969474df6043))
* **frontend:** add request details page /requests/[id] ([6f18dff](https://github.com/maslennikov-ig/BuhBot/commit/6f18dff7a3861a64e1b18d4c494758169f689a5b))
* **hero:** Add light theme and 8 chat scenarios to HeroChatMockup ([429a3a6](https://github.com/maslennikov-ig/BuhBot/commit/429a3a6a79c0d919a1f31a9d2ed3e4cc30dbfff3))
* implement 4 GitHub issues (gh-8, gh-12, gh-13, gh-15) ([a1caee9](https://github.com/maslennikov-ig/BuhBot/commit/a1caee95fe5d76d02cafaec29f095f4d9d207634))
* implement robust theme management with next-themes ([281c102](https://github.com/maslennikov-ig/BuhBot/commit/281c102ab6e363afa0a1d715342e13321005f540))
* **infrastructure:** complete Phase 1 Setup - project initialization ([7988d84](https://github.com/maslennikov-ig/BuhBot/commit/7988d84d8b3559ea0e91a064896e1076f01f654f))
* **landing:** Add animated chat mockup to Hero section ([cf6a3ec](https://github.com/maslennikov-ig/BuhBot/commit/cf6a3ec87e9f0f1a5c502f0dedb934896a620bcd))
* **landing:** add section IDs for smooth scroll navigation ([bc3b02a](https://github.com/maslennikov-ig/BuhBot/commit/bc3b02ab59220d5317ae83fe373a37befb9e2e64))
* **logging:** add ErrorCaptureService with MD5 fingerprinting (buh-65g) ([8e68351](https://github.com/maslennikov-ig/BuhBot/commit/8e68351648997f9fd03f239e39a72fc6839b7121))
* **navigation:** add System Logs item to AdminLayout (buh-xla) ([0e8a4f3](https://github.com/maslennikov-ig/BuhBot/commit/0e8a4f304bb3a1b8adaff2c257b3d1abe549a105))
* **notifications:** Link SLA alerts to in-app notifications ([8532bb2](https://github.com/maslennikov-ig/BuhBot/commit/8532bb2363f23f1aa742e26b08fe8520a2641aa3))
* notify all accountants from accountantUsernames array (buh-k5a) ([484d21f](https://github.com/maslennikov-ig/BuhBot/commit/484d21f364fc4f157888c0ccd35330517d551e1a))
* **reports:** Implement reports section with export functionality ([fefa74a](https://github.com/maslennikov-ig/BuhBot/commit/fefa74a6ecc40bcefa57b958fd72bd87b4d00a4b))
* **requests:** show accountant response in requests table ([2b1b06d](https://github.com/maslennikov-ig/BuhBot/commit/2b1b06df82599c5a0dc7b3eae0024095edfe57bc))
* SLA Monitoring System (MODULE 1.1) ([#2](https://github.com/maslennikov-ig/BuhBot/issues/2)) ([f1f5a7a](https://github.com/maslennikov-ig/BuhBot/commit/f1f5a7af4f4260585829698baf11179f6cded511))
* SLA Monitoring System (Module 1.1) + Infrastructure ([f1f5a7a](https://github.com/maslennikov-ig/BuhBot/commit/f1f5a7af4f4260585829698baf11179f6cded511))
* **sla:** add SLA timer recovery on server restart ([e01bacf](https://github.com/maslennikov-ig/BuhBot/commit/e01bacfd4dac17b374fd3df9b2685d238da02469))
* **telegram:** implement Telegram Login integration (006) ([d3f3fdc](https://github.com/maslennikov-ig/BuhBot/commit/d3f3fdc69d3bc76b8db124190d64e728e4453789))
* **users:** Add full user management for admins ([c43cc82](https://github.com/maslennikov-ig/BuhBot/commit/c43cc82a7d0134b40c7ff4d034336b08351b67be))


### Bug Fixes

* **007:** Code review improvements ([dd27da5](https://github.com/maslennikov-ig/BuhBot/commit/dd27da5fdfe7ad57e2a95b31ffdff177e371e2c0))
* **007:** Implement shadcn Select component ([f797340](https://github.com/maslennikov-ig/BuhBot/commit/f7973407b28cd83684f8801c1ad94aca5d5dacbc))
* add IPv4-first DNS resolution and diagnostic logging ([342e1c3](https://github.com/maslennikov-ig/BuhBot/commit/342e1c3aae89fd6ea0b2e97510f822260821fb56))
* **alerts:** send notification to accountant DM instead of group ([3b34954](https://github.com/maslennikov-ig/BuhBot/commit/3b34954120b53dab1fc0d7296ab686dc8b0ec66c))
* **alerts:** Use actual data for quick stats counters ([14cb6d6](https://github.com/maslennikov-ig/BuhBot/commit/14cb6d6b86b52f806220780ebf508c9ac74887c3))
* **alerts:** use assignedAccountant relation for notify button ([5828296](https://github.com/maslennikov-ig/BuhBot/commit/5828296e5365cedfee5052263632b89894a323c7))
* **analytics:** use z.coerce.date() for all date inputs in tRPC ([18cb31e](https://github.com/maslennikov-ig/BuhBot/commit/18cb31eedcd3858b5fb5238729958136472b7383))
* **api:** cascade delete chat_message when deleting client_request ([5c0a272](https://github.com/maslennikov-ig/BuhBot/commit/5c0a272112aa20e930fdaa63077ee290ff589a36))
* **api:** remove direction param conflict with tRPC infinite query ([1d199fa](https://github.com/maslennikov-ig/BuhBot/commit/1d199fa2fbeab50fd5f7648514f25d11b4f40541))
* **api:** Use z.coerce.date() for exportReport input ([0be12b6](https://github.com/maslennikov-ig/BuhBot/commit/0be12b684ff6730e5bc6c23c56ad668b1be61f5a))
* **auth:** add null check for supabase client in LoginForm ([214d267](https://github.com/maslennikov-ig/BuhBot/commit/214d267ed48ad2f5ff88f482a354c48956aab871))
* **auth:** Fix deleteUser enum type mismatch with Prisma pg-adapter ([0dc137f](https://github.com/maslennikov-ig/BuhBot/commit/0dc137fe8be0ec78777fda59fa0bb1d54bc20852))
* **auth:** Wrap SetPasswordForm in Suspense boundary ([d938b2b](https://github.com/maslennikov-ig/BuhBot/commit/d938b2ba08d5827bd360b53b483a135b8cf6af65))
* auto-add accountant username when assigned via dropdown ([65cd4c9](https://github.com/maslennikov-ig/BuhBot/commit/65cd4c98aab9de760a02cc1c30eb90660e55c9ee))
* **backend:** add .js extensions to tRPC imports for ESM compatibility ([5f13d91](https://github.com/maslennikov-ig/BuhBot/commit/5f13d91d6323d6d000bfc28f74428a28ac096464))
* **backend:** convert undefined to null for contact notification payload ([47ba96d](https://github.com/maslennikov-ig/BuhBot/commit/47ba96d5a764f99dfcfa3f1d0b7b66e5d6cfea13))
* **backend:** remove [@default](https://github.com/default) from GlobalSettings.id to fix UUID parsing ([c4afc01](https://github.com/maslennikov-ig/BuhBot/commit/c4afc01cc3d6344dea38b5ee07565f319d08b5fd))
* **backend:** resolve all audit issues (P0-P3) ([7364984](https://github.com/maslennikov-ig/BuhBot/commit/7364984f999725f68899b27479b9c51a5e5dbadf))
* **backend:** use bracket notation for env var access to satisfy TypeScript strict mode ([22671f4](https://github.com/maslennikov-ig/BuhBot/commit/22671f4adaf0dd87c5208d76b368cadadb9e8f84))
* **backend:** use raw SQL for contact insert as workaround for Prisma 7 UUID bug ([1797ec7](https://github.com/maslennikov-ig/BuhBot/commit/1797ec7ee02a76a9ecae6e20e51c5a4d5faad107))
* **bot:** correct webhook middleware integration with Express ([a031268](https://github.com/maslennikov-ig/BuhBot/commit/a031268cd45fd7c26e4c6fbb5155dca6d2b4678a))
* **bot:** enable polling fallback in prod, fix accountant select, add /info command ([fc3a244](https://github.com/maslennikov-ig/BuhBot/commit/fc3a244fbb621cc9cdb48d87f2b8fb1731bff6a8))
* **bot:** improve accountant detection using User table ([7ef66e1](https://github.com/maslennikov-ig/BuhBot/commit/7ef66e1d2f344d2b4ebfc63297515aa400d75c21))
* **bot:** integrate Telegram bot initialization into backend entry point ([c5b93a9](https://github.com/maslennikov-ig/BuhBot/commit/c5b93a9c1513cd3c4aef222bff239ba8e946d4bf))
* **bot:** register webhook route before 404 handler ([e5ff392](https://github.com/maslennikov-ig/BuhBot/commit/e5ff3925d10dfcf63080cf2cc8ae0d368ea1026b))
* **bot:** reorder handler registration for /menu and /template commands ([983c2c8](https://github.com/maslennikov-ig/BuhBot/commit/983c2c88f52b27c12a360ea24ebf689f461aad9b))
* **bot:** use createWebhook instead of webhookCallback ([5436f83](https://github.com/maslennikov-ig/BuhBot/commit/5436f830a4f78957d57c35e60b829c2c4a49ffc4))
* **build:** include Prisma generated files in TypeScript compilation ([2e3ecc3](https://github.com/maslennikov-ig/BuhBot/commit/2e3ecc34d735c92b592c0fb810f7a308b4945864))
* change User.role from enum to String for DB compatibility ([5ce7ff0](https://github.com/maslennikov-ig/BuhBot/commit/5ce7ff0239c52fc6141554b1418ad0079abcdad2))
* **chats:** enforce strict BOT_USERNAME check for invitations ([d60cb8f](https://github.com/maslennikov-ig/BuhBot/commit/d60cb8fbfab897ee398e8c78a1572cb7893f7a05))
* **ci:** exclude Docker-created dirs from rsync sync ([f130a3d](https://github.com/maslennikov-ig/BuhBot/commit/f130a3da6707b4963be72fe248f4247a03c0d25e))
* **ci:** fix eslint errors in notification, user routers and invitation handler ([8c4d983](https://github.com/maslennikov-ig/BuhBot/commit/8c4d983eca8bdb1e827e55e98a35ce743584caa4))
* **ci:** regenerate backend package-lock.json for Docker build ([bb9175d](https://github.com/maslennikov-ig/BuhBot/commit/bb9175d456388cdb6f6812a7c17aeec4c291778d))
* **ci:** remove CRLF line endings from workflow files ([890d2d8](https://github.com/maslennikov-ig/BuhBot/commit/890d2d8b868f7e66b46c06fd9938ce02e865c686))
* **ci:** remove frontend pnpm-lock.yaml for npm-based Docker build ([81dc4ec](https://github.com/maslennikov-ig/BuhBot/commit/81dc4ecc3f2c11f2b360d3f6c553233ec7664402))
* **ci:** resolve ESLint error and sync frontend lock file ([7f46e78](https://github.com/maslennikov-ig/BuhBot/commit/7f46e78ad6cf1e6e9627be5c0409fb12851ba9fc))
* **ci:** skip telegram notification when deploy is skipped ([72ddd72](https://github.com/maslennikov-ig/BuhBot/commit/72ddd72c02c930737b6b9989365a2599438a9539))
* **ci:** sync backend package-lock.json for Docker build ([0230312](https://github.com/maslennikov-ig/BuhBot/commit/023031248d116599548425588486e920f55ccedc))
* **ci:** sync backend package-lock.json with npm (not pnpm) ([0e831df](https://github.com/maslennikov-ig/BuhBot/commit/0e831df2d34e89cf333259fdc11d66591df81005))
* **ci:** update pnpm-lock.yaml to include tsx dependency ([3f43c80](https://github.com/maslennikov-ig/BuhBot/commit/3f43c80a4911e7170c9a746b0c2746ab53ea38d3))
* **ci:** use default import for logger ([b7ee219](https://github.com/maslennikov-ig/BuhBot/commit/b7ee2193fd02c9552ad4cb6310ff23d90b7a7058))
* **ci:** use lowercase repository name for Docker image tags ([ceb08ef](https://github.com/maslennikov-ig/BuhBot/commit/ceb08efad2ce19abad19f12bc2dcdc423437e63b))
* **config:** require BOT_USERNAME env var for deep links ([7f03672](https://github.com/maslennikov-ig/BuhBot/commit/7f0367278981f9c8fe575f97ebc1e984d0a10c70))
* **dashboard:** Add violations chart data to dashboard widget ([2043ad6](https://github.com/maslennikov-ig/BuhBot/commit/2043ad6a4a5cda36020b2a16088102290bcddec9))
* **deploy:** add SSH keepalive to prevent connection timeout ([fb1c0eb](https://github.com/maslennikov-ig/BuhBot/commit/fb1c0eb44ad219f64c56c23bdf4feaa165a8cc90))
* **deploy:** fix secrets context not allowed in step if condition ([4f9ef28](https://github.com/maslennikov-ig/BuhBot/commit/4f9ef28730fe55496e58132104da5be485270bd4))
* **deploy:** increase wait-on-check timeout to 15 minutes ([ca4b9f9](https://github.com/maslennikov-ig/BuhBot/commit/ca4b9f96b9514d6d0e3e09bdd82fc04fabf108c7))
* **deploy:** update production URL to buhbot.aidevteam.ru ([dab885c](https://github.com/maslennikov-ig/BuhBot/commit/dab885c485efa2bfc6bff6b57d66ad2d8b3a967f))
* **deploy:** use pre-built Docker images instead of building on deploy ([06718c3](https://github.com/maslennikov-ig/BuhBot/commit/06718c32beb4e16551a0cbf15c10ab3d394f7f00))
* **deploy:** use root context for frontend Docker build ([6c6842e](https://github.com/maslennikov-ig/BuhBot/commit/6c6842e5423e10cac0cda00ed34476590f5d6742))
* **deps:** add winston-transport as direct dependency ([15f713f](https://github.com/maslennikov-ig/BuhBot/commit/15f713f4c5bc3211e955e3bd41fcbcc65999ba96))
* **docker:** add --legacy-peer-deps for React 19 compatibility ([efacfe7](https://github.com/maslennikov-ig/BuhBot/commit/efacfe76fc19adf0f103bbe25b5a126e65bbe981))
* **docker:** add backend/ prefix to COPY paths for correct build context ([9173e0d](https://github.com/maslennikov-ig/BuhBot/commit/9173e0d897f90d3da83b6a7dc70f156fce914542))
* **docker:** add NEXT_PUBLIC_BOT_NAME build arg for Telegram Login ([2987869](https://github.com/maslennikov-ig/BuhBot/commit/298786963e4a5ceef4a6774d33b23089c92b3e3b))
* **docker:** add package-lock.json for npm ci builds ([347430f](https://github.com/maslennikov-ig/BuhBot/commit/347430ffd032674f04f42dcdf61cb259c818f7ed))
* **docker:** change frontend build context to repo root ([270d792](https://github.com/maslennikov-ig/BuhBot/commit/270d792c825fc8ad6f25cc2d251730118157d797))
* **docker:** regenerate Prisma client in runtime stage ([24e607b](https://github.com/maslennikov-ig/BuhBot/commit/24e607b557cbeb35b704fe0b125d48dc91828afb))
* **docker:** revert COPY paths to match CI build context ([ce2c8f9](https://github.com/maslennikov-ig/BuhBot/commit/ce2c8f974dcb4ecb536fae936a4642d61afc9025))
* **docker:** switch from pnpm to npm in Dockerfiles ([819d938](https://github.com/maslennikov-ig/BuhBot/commit/819d9383820baac2665c4dfa40666e0c082d3a4a))
* **docker:** switch frontend from Alpine to Debian slim for SWC compatibility ([07a9f60](https://github.com/maslennikov-ig/BuhBot/commit/07a9f60fd9db2f684bcf3c28e9cc40a6b7d5aa69))
* **docker:** switch to node:18-slim for Prisma OpenSSL compatibility ([fbcb551](https://github.com/maslennikov-ig/BuhBot/commit/fbcb55127c13fae8b53071f59d582ceb2b60e893))
* **docker:** use Node 18 Alpine for Prisma OpenSSL compatibility ([f2365cd](https://github.com/maslennikov-ig/BuhBot/commit/f2365cdb961b2d2d743190eaa33f6b2a8d675717))
* **docker:** use npm install --legacy-peer-deps instead of npm ci ([888aaab](https://github.com/maslennikov-ig/BuhBot/commit/888aaab0019c2fff4f0efc6ad7103747d15cd68d))
* env validation for CI tests and deploy pre-flight ([#25](https://github.com/maslennikov-ig/BuhBot/issues/25)) ([f2bfd3b](https://github.com/maslennikov-ig/BuhBot/commit/f2bfd3b174b472d235a0627ae255357592a8f2dd))
* **frontend:** add explicit left/top positioning for cursor glow ([24effc1](https://github.com/maslennikov-ig/BuhBot/commit/24effc152b35d93669969ee924bccccc8853af74))
* **frontend:** add layoutRoot for Yandex Browser compatibility ([df92fcf](https://github.com/maslennikov-ig/BuhBot/commit/df92fcff457b36ae71b0d8e937088f233863c0b2))
* **frontend:** capture supabase in variable for TypeScript narrowing ([e94b867](https://github.com/maslennikov-ig/BuhBot/commit/e94b867bb6a3bb1cfcc5b573e31853d292a40fa9))
* **frontend:** correct cursor glow positioning using useMotionValue ([962e65c](https://github.com/maslennikov-ig/BuhBot/commit/962e65c6b03aa30e4f60e87174899d4ba8c2100a))
* **frontend:** correct tRPC API path from /trpc to /api/trpc ([b819856](https://github.com/maslennikov-ig/BuhBot/commit/b81985642224e05d9f4aa1ef9f13e95fe08d5a70))
* **frontend:** fix response time chart overflow on analytics page ([5fa9ff8](https://github.com/maslennikov-ig/BuhBot/commit/5fa9ff8e38147e4b8bfe48cf1e887074703bdfcf))
* **frontend:** prevent TelegramLoginButton widget re-initialization ([98c34bf](https://github.com/maslennikov-ig/BuhBot/commit/98c34bf0191a5656dc139f0d119bb0f352f57339))
* **frontend:** replace empty string values in Select components ([922cf38](https://github.com/maslennikov-ig/BuhBot/commit/922cf38f60048b027ace0f9f7256e08dcc656598))
* **frontend:** use devMockUser from config instead of devMockSession ([4bb13d2](https://github.com/maslennikov-ig/BuhBot/commit/4bb13d2146cbc92309c8245dfe52ab10da320bf9))
* HelpButton TypeScript error ([6df3cdb](https://github.com/maslennikov-ig/BuhBot/commit/6df3cdb2f5d047ccf8e5f63b5c38a4a88c22da33))
* **imports:** use relative paths instead of aliases for build compatibility ([62e4127](https://github.com/maslennikov-ig/BuhBot/commit/62e412774a55c92e01f09f5a5f40117dd20cb02c))
* improve login page light theme support and add theme toggle ([ffaca0d](https://github.com/maslennikov-ig/BuhBot/commit/ffaca0d6ee0eae35483129463d96d934b43e5937))
* **infra:** remove security restrictions causing container crashes ([639514d](https://github.com/maslennikov-ig/BuhBot/commit/639514dd3720818b231559d3f0f8f7a38252063a))
* **lint:** resolve TypeScript and ESLint errors for CI ([5e91a99](https://github.com/maslennikov-ig/BuhBot/commit/5e91a99cbbf0897f3239f83c6981f85f87e83abe))
* **logo:** Add cache-busting version param ([61b15dc](https://github.com/maslennikov-ig/BuhBot/commit/61b15dc077fd30e11e018600119f3d073e7471db))
* **logo:** Add unoptimized to preserve PNG quality (prevent WebP conversion) ([761551e](https://github.com/maslennikov-ig/BuhBot/commit/761551e62a865ba3ecc1d5e37623aa8120d572f5))
* **logo:** Fix theme-aware logo switching and increase Header size ([dc1c3d7](https://github.com/maslennikov-ig/BuhBot/commit/dc1c3d78b03921ecd7d6425397b5941a5186258a))
* **logo:** Increase xl size to h-14 (56px) for Header logo ([5c79b0b](https://github.com/maslennikov-ig/BuhBot/commit/5c79b0bfe1e372c044ee4e0b1238c00b69e07df6))
* **logo:** Regenerate logos from source with max quality (400px, Lanczos) ([98d956d](https://github.com/maslennikov-ig/BuhBot/commit/98d956d568b36182cee804508887d4cb5686e9fe))
* **logo:** Remove query params breaking Next.js Image ([ed5cdd2](https://github.com/maslennikov-ig/BuhBot/commit/ed5cdd26eb72b394893608dc85cb1ab6c576c1fd))
* **logo:** Swap logo files so emails use light version ([0fea50b](https://github.com/maslennikov-ig/BuhBot/commit/0fea50bd4465f6ef25d20710ddd613d09496c9d8))
* Multiple UI and backend fixes ([f368c45](https://github.com/maslennikov-ig/BuhBot/commit/f368c45e837e97adf18ed1ec2b94dad35bbe9406))
* **prisma:** switch to prisma-client-js for runtime compatibility ([dbf7001](https://github.com/maslennikov-ig/BuhBot/commit/dbf7001cae2090bb09414cac18429f3384276965))
* **reports:** Add white text to modal generate button ([36cedcd](https://github.com/maslennikov-ig/BuhBot/commit/36cedcd2f9ee577b5961b92401e65aca23e48d3e))
* **reports:** Fix button text color and React hook error ([935f281](https://github.com/maslennikov-ig/BuhBot/commit/935f281ff043d65e5688bfbe8f8b5fe944730a2b))
* resolve 6 P1-P2 production bugs ([02e5827](https://github.com/maslennikov-ig/BuhBot/commit/02e582759192d644fb762089cbb28d620beef1bf))
* resolve TypeScript errors blocking CI ([3739160](https://github.com/maslennikov-ig/BuhBot/commit/37391604526a2613542a3d85cd40672a0723e263))
* **security:** update Next.js to 16.0.10 - CVE-2025-55182/CVE-2025-66478 ([e3e69ca](https://github.com/maslennikov-ig/BuhBot/commit/e3e69ca3ae4a5d471961efd885edf30a3902ff38))
* **sidebar:** Don't highlight parent nav when child is active ([344ec77](https://github.com/maslennikov-ig/BuhBot/commit/344ec77229debe77de761e340326d4f1a0a8ccd2))
* **sidebar:** Simplify active nav item logic ([4db5631](https://github.com/maslennikov-ig/BuhBot/commit/4db56311dc1ea71e58db50501d6f55a21bc3a24d))
* SLA timer now stops on accountant response + dropdown menu visibility ([657da82](https://github.com/maslennikov-ig/BuhBot/commit/657da828c38615e3292ce14d4dbfa2723029b0d4))
* **sla:** complete SLA notification system fixes and testing ([9e6532a](https://github.com/maslennikov-ig/BuhBot/commit/9e6532af88db1f04792149b2762b1a5f3ab96a01))
* **sla:** fix notifyInChatOnBreach and global threshold update (gh-16, gh-17) ([6d4cca9](https://github.com/maslennikov-ig/BuhBot/commit/6d4cca940d32a46d4a8be46b067b1d5419c00ddf))
* **sla:** initialize BullMQ workers for SLA monitoring ([70f1698](https://github.com/maslennikov-ig/BuhBot/commit/70f1698762d7d238d9f323de4d90e97cb72c6ee0))
* **sla:** use IN operator for enum comparison in Prisma 7 ([f923928](https://github.com/maslennikov-ig/BuhBot/commit/f923928407bc63e60c9d917103cee3ae225efe68))
* sync package-lock.json with new dependencies ([19a799d](https://github.com/maslennikov-ig/BuhBot/commit/19a799dce40d01a8a3b7f4116a7d92e1f5702a9d))
* **test:** fix ESLint errors in sla-timer.worker.test.ts ([25b3bb3](https://github.com/maslennikov-ig/BuhBot/commit/25b3bb3d35f1885ee1cadd6d1e9d098f856c22ec))
* **test:** use relative paths in vi.mock() for response handler tests (gh-29) ([73bd662](https://github.com/maslennikov-ig/BuhBot/commit/73bd6622f2749a8441115a5a086e9fc0e9a63b1b))
* **types:** add explicit ClientRequest type to response handler ([5fbdabb](https://github.com/maslennikov-ig/BuhBot/commit/5fbdabb894fe9ec5a4de2704918b381514e13d1c))
* **types:** convert Prisma bigint to number in tRPC routers ([a87406a](https://github.com/maslennikov-ig/BuhBot/commit/a87406a635815fa05b822ec1936db69256b75fb4))
* **ui:** Add popover/dropdown background colors to theme ([8e36629](https://github.com/maslennikov-ig/BuhBot/commit/8e36629ece898f5304755df163edbe61d3326e6b))
* **ui:** Fix tabs styling and translate to Russian ([ba70489](https://github.com/maslennikov-ig/BuhBot/commit/ba70489df3563efb6f628276b80ec11eb96ff3dc))
* **ui:** Restyle AlertsPage to match project design system ([96957df](https://github.com/maslennikov-ig/BuhBot/commit/96957df08097dd900925296e6cc5d337d7b5380f))
* **ui:** Rewrite AlertsPage to match Chats page structure ([5076b30](https://github.com/maslennikov-ig/BuhBot/commit/5076b30299fc3baf761bcc64a69547113c9b25e8))
* use const for finalUsernames (lint error) ([96f4d92](https://github.com/maslennikov-ig/BuhBot/commit/96f4d92da6d8bc1a6194f612f9ee653a7e54df2c))
* **users:** allow selecting admins as accountants ([3c0e188](https://github.com/maslennikov-ig/BuhBot/commit/3c0e188624614ed07f615b6084957a3ddfaeabdd))
* **webhook:** skip express.json() for Telegram webhook path ([1cb266b](https://github.com/maslennikov-ig/BuhBot/commit/1cb266bf36298e6c22c24b0d4419fe65efcf484f))
* **webhook:** use explicit POST route for Telegraf middleware ([f2081af](https://github.com/maslennikov-ig/BuhBot/commit/f2081af80244867314867e5b1013142531f21ae9))

## [0.10.0](https://github.com/maslennikov-ig/BuhBot/compare/buhbot-v0.9.19...buhbot-v0.10.0) (2026-02-03)


### Features

* **.claude/skills/systematic-debugging/condition-based-waiting-example.ts:** add 17 source file(s), add 4 agent(s), +7 more ([7cc7cdc](https://github.com/maslennikov-ig/BuhBot/commit/7cc7cdce09f1f10e83ba1336bdeaf160bcdc5cf7))
* **007:** Implement Admin CRUD Pages ([1cd27c7](https://github.com/maslennikov-ig/BuhBot/commit/1cd27c742c5da1f44d2619e226fcc78a6215fe14))
* **accountants:** add multiple accountant usernames support ([8587966](https://github.com/maslennikov-ig/BuhBot/commit/858796602617c54e65f577bb0b938e4c0d89587b))
* add 1 skill(s), update docs ([40c751a](https://github.com/maslennikov-ig/BuhBot/commit/40c751aec07c46aae9224bab6d331822502eb732))
* add chat delete functionality ([aa16d15](https://github.com/maslennikov-ig/BuhBot/commit/aa16d15770a0443779b4d42e581a8d3a501ae43e))
* add DEV MODE for local development without Supabase ([402e5f1](https://github.com/maslennikov-ig/BuhBot/commit/402e5f1502284fe35c01b0a3715efed56bd2f01f))
* add DEV MODE for local development without Supabase ([a56d9a7](https://github.com/maslennikov-ig/BuhBot/commit/a56d9a7bde9f06be3bc495add9ed13613d52780c))
* add invite_link to Chat model for universal 'Open chat' button support (buh-8tp) ([fbf8510](https://github.com/maslennikov-ig/BuhBot/commit/fbf8510e6bcb1fce2899581c7e86fec97bc3cd19))
* add password visibility toggle and fix light mode visibility in login ([9a6cf15](https://github.com/maslennikov-ig/BuhBot/commit/9a6cf15a5e864f3de7dcdc67ef5b2ac0baaa1c75))
* add Violations and Help menu items, create Help page ([162f266](https://github.com/maslennikov-ig/BuhBot/commit/162f2669b4bbe50dc16974d3ecac2c90154bf0ca))
* **agents:** add nextjs-ui-designer agent ([04fd327](https://github.com/maslennikov-ig/BuhBot/commit/04fd327c29286b4d9feab15f9806a66d5644d064))
* **agents:** add supabase-fixer agent ([7ab2cfe](https://github.com/maslennikov-ig/BuhBot/commit/7ab2cfe94d2236ae5ee1e1bf849465339ec9b079))
* **agents:** create 8 infrastructure worker agents for BuhBot deployment ([5b01434](https://github.com/maslennikov-ig/BuhBot/commit/5b0143475bf7a4b488f25d6589531d61a0c3980d))
* **analytics:** Add response time analytics page and table sorting ([1f5698a](https://github.com/maslennikov-ig/BuhBot/commit/1f5698a2bdd4b560a2aea5fc1a150b4d78c9b55e))
* **api:** add accountantUsernames array support to chats router ([048bf1c](https://github.com/maslennikov-ig/BuhBot/commit/048bf1ce537c2715b5a92f45404b6f771e5af8b1))
* **api:** add tRPC logs router for error logs management (buh-zdc) ([5e3be7e](https://github.com/maslennikov-ig/BuhBot/commit/5e3be7eb70c558ae498ab0e52a772f1785e3e173))
* **auth:** Add user invitation flow with Supabase Auth ([66b8a4b](https://github.com/maslennikov-ig/BuhBot/commit/66b8a4bfb7f428066052fb1138078f1007b32931))
* **backend:** complete Phase 3 - Supabase database setup ([142ca9f](https://github.com/maslennikov-ig/BuhBot/commit/142ca9f79d02e81e854ce3199ee9b9b1577fe4c7))
* **backend:** integrate tRPC Express adapter ([a6c0d39](https://github.com/maslennikov-ig/BuhBot/commit/a6c0d399ad3553c0152e2201b2f94872dd6c6f78))
* **bot:** add /help command handler ([36485d3](https://github.com/maslennikov-ig/BuhBot/commit/36485d315df136c2411a75ccdd744303df74cd0c))
* **branding:** Add light theme logo + increase Hero text size ([470e29b](https://github.com/maslennikov-ig/BuhBot/commit/470e29b1e14449fb13f5112006c03d786283a8c6))
* **branding:** Add logo image to Header, Footer, Auth pages ([63e51f0](https://github.com/maslennikov-ig/BuhBot/commit/63e51f0ffebb1edfe39386bfed7b715ffe32fe7b))
* **ci:** add Telegram notification on CI failure ([585f6cd](https://github.com/maslennikov-ig/BuhBot/commit/585f6cda64b312ed1b2c65ee67050c092ce72bac))
* **classifier:** add metrics, circuit breaker, and message filtering ([e152d29](https://github.com/maslennikov-ig/BuhBot/commit/e152d29ff12d1a267824dace98031f022a69d2f2))
* **classifier:** improve Russian classification prompt with few-shot examples ([dd57b75](https://github.com/maslennikov-ig/BuhBot/commit/dd57b750c5a9d6b5ca46dba0d177fd4c3cdb7aa4))
* **database:** add ErrorLog model for centralized error tracking (buh-oyj) ([7830439](https://github.com/maslennikov-ig/BuhBot/commit/7830439e3d2023f2e1a250e652b5b7beffb3aaa9))
* **deploy:** add pre-flight checks for dependencies and ports ([b78cac2](https://github.com/maslennikov-ig/BuhBot/commit/b78cac28040fd4734720139b46715c324dd31d73))
* **deps:** migrate Prisma 5.22 to 7.0 ([785e16e](https://github.com/maslennikov-ig/BuhBot/commit/785e16e9849b141d9494d27427a6f40dc19d7554))
* **dev-mode:** implement DEV MODE for local development without Supabase ([23250fa](https://github.com/maslennikov-ig/BuhBot/commit/23250fa151b00dbe5f10a032c836e166936fc689))
* **frontend:** add action buttons for requests management ([8fcb1c2](https://github.com/maslennikov-ig/BuhBot/commit/8fcb1c29ecc94a0958bfada2fa39260fa752c561))
* **frontend:** add complete logs/errors UI with pages and components (buh-mgs, buh-brr) ([3fe4d8e](https://github.com/maslennikov-ig/BuhBot/commit/3fe4d8e8a90864fc2debd3a0e63d969474df6043))
* **frontend:** add request details page /requests/[id] ([6f18dff](https://github.com/maslennikov-ig/BuhBot/commit/6f18dff7a3861a64e1b18d4c494758169f689a5b))
* **hero:** Add light theme and 8 chat scenarios to HeroChatMockup ([429a3a6](https://github.com/maslennikov-ig/BuhBot/commit/429a3a6a79c0d919a1f31a9d2ed3e4cc30dbfff3))
* implement 4 GitHub issues (gh-8, gh-12, gh-13, gh-15) ([a1caee9](https://github.com/maslennikov-ig/BuhBot/commit/a1caee95fe5d76d02cafaec29f095f4d9d207634))
* implement robust theme management with next-themes ([281c102](https://github.com/maslennikov-ig/BuhBot/commit/281c102ab6e363afa0a1d715342e13321005f540))
* **infrastructure:** complete Phase 1 Setup - project initialization ([7988d84](https://github.com/maslennikov-ig/BuhBot/commit/7988d84d8b3559ea0e91a064896e1076f01f654f))
* **landing:** Add animated chat mockup to Hero section ([cf6a3ec](https://github.com/maslennikov-ig/BuhBot/commit/cf6a3ec87e9f0f1a5c502f0dedb934896a620bcd))
* **landing:** add section IDs for smooth scroll navigation ([bc3b02a](https://github.com/maslennikov-ig/BuhBot/commit/bc3b02ab59220d5317ae83fe373a37befb9e2e64))
* **logging:** add ErrorCaptureService with MD5 fingerprinting (buh-65g) ([8e68351](https://github.com/maslennikov-ig/BuhBot/commit/8e68351648997f9fd03f239e39a72fc6839b7121))
* **navigation:** add System Logs item to AdminLayout (buh-xla) ([0e8a4f3](https://github.com/maslennikov-ig/BuhBot/commit/0e8a4f304bb3a1b8adaff2c257b3d1abe549a105))
* **notifications:** Link SLA alerts to in-app notifications ([8532bb2](https://github.com/maslennikov-ig/BuhBot/commit/8532bb2363f23f1aa742e26b08fe8520a2641aa3))
* notify all accountants from accountantUsernames array (buh-k5a) ([484d21f](https://github.com/maslennikov-ig/BuhBot/commit/484d21f364fc4f157888c0ccd35330517d551e1a))
* **reports:** Implement reports section with export functionality ([fefa74a](https://github.com/maslennikov-ig/BuhBot/commit/fefa74a6ecc40bcefa57b958fd72bd87b4d00a4b))
* **requests:** show accountant response in requests table ([2b1b06d](https://github.com/maslennikov-ig/BuhBot/commit/2b1b06df82599c5a0dc7b3eae0024095edfe57bc))
* SLA Monitoring System (MODULE 1.1) ([#2](https://github.com/maslennikov-ig/BuhBot/issues/2)) ([f1f5a7a](https://github.com/maslennikov-ig/BuhBot/commit/f1f5a7af4f4260585829698baf11179f6cded511))
* SLA Monitoring System (Module 1.1) + Infrastructure ([f1f5a7a](https://github.com/maslennikov-ig/BuhBot/commit/f1f5a7af4f4260585829698baf11179f6cded511))
* **sla:** add SLA timer recovery on server restart ([e01bacf](https://github.com/maslennikov-ig/BuhBot/commit/e01bacfd4dac17b374fd3df9b2685d238da02469))
* **telegram:** implement Telegram Login integration (006) ([d3f3fdc](https://github.com/maslennikov-ig/BuhBot/commit/d3f3fdc69d3bc76b8db124190d64e728e4453789))
* **users:** Add full user management for admins ([c43cc82](https://github.com/maslennikov-ig/BuhBot/commit/c43cc82a7d0134b40c7ff4d034336b08351b67be))


### Bug Fixes

* **007:** Code review improvements ([dd27da5](https://github.com/maslennikov-ig/BuhBot/commit/dd27da5fdfe7ad57e2a95b31ffdff177e371e2c0))
* **007:** Implement shadcn Select component ([f797340](https://github.com/maslennikov-ig/BuhBot/commit/f7973407b28cd83684f8801c1ad94aca5d5dacbc))
* add IPv4-first DNS resolution and diagnostic logging ([342e1c3](https://github.com/maslennikov-ig/BuhBot/commit/342e1c3aae89fd6ea0b2e97510f822260821fb56))
* **alerts:** send notification to accountant DM instead of group ([3b34954](https://github.com/maslennikov-ig/BuhBot/commit/3b34954120b53dab1fc0d7296ab686dc8b0ec66c))
* **alerts:** Use actual data for quick stats counters ([14cb6d6](https://github.com/maslennikov-ig/BuhBot/commit/14cb6d6b86b52f806220780ebf508c9ac74887c3))
* **alerts:** use assignedAccountant relation for notify button ([5828296](https://github.com/maslennikov-ig/BuhBot/commit/5828296e5365cedfee5052263632b89894a323c7))
* **analytics:** use z.coerce.date() for all date inputs in tRPC ([18cb31e](https://github.com/maslennikov-ig/BuhBot/commit/18cb31eedcd3858b5fb5238729958136472b7383))
* **api:** cascade delete chat_message when deleting client_request ([5c0a272](https://github.com/maslennikov-ig/BuhBot/commit/5c0a272112aa20e930fdaa63077ee290ff589a36))
* **api:** remove direction param conflict with tRPC infinite query ([1d199fa](https://github.com/maslennikov-ig/BuhBot/commit/1d199fa2fbeab50fd5f7648514f25d11b4f40541))
* **api:** Use z.coerce.date() for exportReport input ([0be12b6](https://github.com/maslennikov-ig/BuhBot/commit/0be12b684ff6730e5bc6c23c56ad668b1be61f5a))
* **auth:** add null check for supabase client in LoginForm ([214d267](https://github.com/maslennikov-ig/BuhBot/commit/214d267ed48ad2f5ff88f482a354c48956aab871))
* **auth:** Fix deleteUser enum type mismatch with Prisma pg-adapter ([0dc137f](https://github.com/maslennikov-ig/BuhBot/commit/0dc137fe8be0ec78777fda59fa0bb1d54bc20852))
* **auth:** Wrap SetPasswordForm in Suspense boundary ([d938b2b](https://github.com/maslennikov-ig/BuhBot/commit/d938b2ba08d5827bd360b53b483a135b8cf6af65))
* auto-add accountant username when assigned via dropdown ([65cd4c9](https://github.com/maslennikov-ig/BuhBot/commit/65cd4c98aab9de760a02cc1c30eb90660e55c9ee))
* **backend:** add .js extensions to tRPC imports for ESM compatibility ([5f13d91](https://github.com/maslennikov-ig/BuhBot/commit/5f13d91d6323d6d000bfc28f74428a28ac096464))
* **backend:** convert undefined to null for contact notification payload ([47ba96d](https://github.com/maslennikov-ig/BuhBot/commit/47ba96d5a764f99dfcfa3f1d0b7b66e5d6cfea13))
* **backend:** remove [@default](https://github.com/default) from GlobalSettings.id to fix UUID parsing ([c4afc01](https://github.com/maslennikov-ig/BuhBot/commit/c4afc01cc3d6344dea38b5ee07565f319d08b5fd))
* **backend:** resolve all audit issues (P0-P3) ([7364984](https://github.com/maslennikov-ig/BuhBot/commit/7364984f999725f68899b27479b9c51a5e5dbadf))
* **backend:** use bracket notation for env var access to satisfy TypeScript strict mode ([22671f4](https://github.com/maslennikov-ig/BuhBot/commit/22671f4adaf0dd87c5208d76b368cadadb9e8f84))
* **backend:** use raw SQL for contact insert as workaround for Prisma 7 UUID bug ([1797ec7](https://github.com/maslennikov-ig/BuhBot/commit/1797ec7ee02a76a9ecae6e20e51c5a4d5faad107))
* **bot:** correct webhook middleware integration with Express ([a031268](https://github.com/maslennikov-ig/BuhBot/commit/a031268cd45fd7c26e4c6fbb5155dca6d2b4678a))
* **bot:** enable polling fallback in prod, fix accountant select, add /info command ([fc3a244](https://github.com/maslennikov-ig/BuhBot/commit/fc3a244fbb621cc9cdb48d87f2b8fb1731bff6a8))
* **bot:** improve accountant detection using User table ([7ef66e1](https://github.com/maslennikov-ig/BuhBot/commit/7ef66e1d2f344d2b4ebfc63297515aa400d75c21))
* **bot:** integrate Telegram bot initialization into backend entry point ([c5b93a9](https://github.com/maslennikov-ig/BuhBot/commit/c5b93a9c1513cd3c4aef222bff239ba8e946d4bf))
* **bot:** register webhook route before 404 handler ([e5ff392](https://github.com/maslennikov-ig/BuhBot/commit/e5ff3925d10dfcf63080cf2cc8ae0d368ea1026b))
* **bot:** reorder handler registration for /menu and /template commands ([983c2c8](https://github.com/maslennikov-ig/BuhBot/commit/983c2c88f52b27c12a360ea24ebf689f461aad9b))
* **bot:** use createWebhook instead of webhookCallback ([5436f83](https://github.com/maslennikov-ig/BuhBot/commit/5436f830a4f78957d57c35e60b829c2c4a49ffc4))
* **build:** include Prisma generated files in TypeScript compilation ([2e3ecc3](https://github.com/maslennikov-ig/BuhBot/commit/2e3ecc34d735c92b592c0fb810f7a308b4945864))
* change User.role from enum to String for DB compatibility ([5ce7ff0](https://github.com/maslennikov-ig/BuhBot/commit/5ce7ff0239c52fc6141554b1418ad0079abcdad2))
* **chats:** enforce strict BOT_USERNAME check for invitations ([d60cb8f](https://github.com/maslennikov-ig/BuhBot/commit/d60cb8fbfab897ee398e8c78a1572cb7893f7a05))
* **ci:** exclude Docker-created dirs from rsync sync ([f130a3d](https://github.com/maslennikov-ig/BuhBot/commit/f130a3da6707b4963be72fe248f4247a03c0d25e))
* **ci:** fix eslint errors in notification, user routers and invitation handler ([8c4d983](https://github.com/maslennikov-ig/BuhBot/commit/8c4d983eca8bdb1e827e55e98a35ce743584caa4))
* **ci:** regenerate backend package-lock.json for Docker build ([bb9175d](https://github.com/maslennikov-ig/BuhBot/commit/bb9175d456388cdb6f6812a7c17aeec4c291778d))
* **ci:** remove CRLF line endings from workflow files ([890d2d8](https://github.com/maslennikov-ig/BuhBot/commit/890d2d8b868f7e66b46c06fd9938ce02e865c686))
* **ci:** remove frontend pnpm-lock.yaml for npm-based Docker build ([81dc4ec](https://github.com/maslennikov-ig/BuhBot/commit/81dc4ecc3f2c11f2b360d3f6c553233ec7664402))
* **ci:** resolve ESLint error and sync frontend lock file ([7f46e78](https://github.com/maslennikov-ig/BuhBot/commit/7f46e78ad6cf1e6e9627be5c0409fb12851ba9fc))
* **ci:** skip telegram notification when deploy is skipped ([72ddd72](https://github.com/maslennikov-ig/BuhBot/commit/72ddd72c02c930737b6b9989365a2599438a9539))
* **ci:** sync backend package-lock.json for Docker build ([0230312](https://github.com/maslennikov-ig/BuhBot/commit/023031248d116599548425588486e920f55ccedc))
* **ci:** sync backend package-lock.json with npm (not pnpm) ([0e831df](https://github.com/maslennikov-ig/BuhBot/commit/0e831df2d34e89cf333259fdc11d66591df81005))
* **ci:** update pnpm-lock.yaml to include tsx dependency ([3f43c80](https://github.com/maslennikov-ig/BuhBot/commit/3f43c80a4911e7170c9a746b0c2746ab53ea38d3))
* **ci:** use default import for logger ([b7ee219](https://github.com/maslennikov-ig/BuhBot/commit/b7ee2193fd02c9552ad4cb6310ff23d90b7a7058))
* **ci:** use lowercase repository name for Docker image tags ([ceb08ef](https://github.com/maslennikov-ig/BuhBot/commit/ceb08efad2ce19abad19f12bc2dcdc423437e63b))
* **config:** require BOT_USERNAME env var for deep links ([7f03672](https://github.com/maslennikov-ig/BuhBot/commit/7f0367278981f9c8fe575f97ebc1e984d0a10c70))
* **dashboard:** Add violations chart data to dashboard widget ([2043ad6](https://github.com/maslennikov-ig/BuhBot/commit/2043ad6a4a5cda36020b2a16088102290bcddec9))
* **deploy:** add SSH keepalive to prevent connection timeout ([fb1c0eb](https://github.com/maslennikov-ig/BuhBot/commit/fb1c0eb44ad219f64c56c23bdf4feaa165a8cc90))
* **deploy:** fix secrets context not allowed in step if condition ([4f9ef28](https://github.com/maslennikov-ig/BuhBot/commit/4f9ef28730fe55496e58132104da5be485270bd4))
* **deploy:** increase wait-on-check timeout to 15 minutes ([ca4b9f9](https://github.com/maslennikov-ig/BuhBot/commit/ca4b9f96b9514d6d0e3e09bdd82fc04fabf108c7))
* **deploy:** update production URL to buhbot.aidevteam.ru ([dab885c](https://github.com/maslennikov-ig/BuhBot/commit/dab885c485efa2bfc6bff6b57d66ad2d8b3a967f))
* **deploy:** use pre-built Docker images instead of building on deploy ([06718c3](https://github.com/maslennikov-ig/BuhBot/commit/06718c32beb4e16551a0cbf15c10ab3d394f7f00))
* **deploy:** use root context for frontend Docker build ([6c6842e](https://github.com/maslennikov-ig/BuhBot/commit/6c6842e5423e10cac0cda00ed34476590f5d6742))
* **deps:** add winston-transport as direct dependency ([15f713f](https://github.com/maslennikov-ig/BuhBot/commit/15f713f4c5bc3211e955e3bd41fcbcc65999ba96))
* **docker:** add --legacy-peer-deps for React 19 compatibility ([efacfe7](https://github.com/maslennikov-ig/BuhBot/commit/efacfe76fc19adf0f103bbe25b5a126e65bbe981))
* **docker:** add backend/ prefix to COPY paths for correct build context ([9173e0d](https://github.com/maslennikov-ig/BuhBot/commit/9173e0d897f90d3da83b6a7dc70f156fce914542))
* **docker:** add NEXT_PUBLIC_BOT_NAME build arg for Telegram Login ([2987869](https://github.com/maslennikov-ig/BuhBot/commit/298786963e4a5ceef4a6774d33b23089c92b3e3b))
* **docker:** add package-lock.json for npm ci builds ([347430f](https://github.com/maslennikov-ig/BuhBot/commit/347430ffd032674f04f42dcdf61cb259c818f7ed))
* **docker:** change frontend build context to repo root ([270d792](https://github.com/maslennikov-ig/BuhBot/commit/270d792c825fc8ad6f25cc2d251730118157d797))
* **docker:** regenerate Prisma client in runtime stage ([24e607b](https://github.com/maslennikov-ig/BuhBot/commit/24e607b557cbeb35b704fe0b125d48dc91828afb))
* **docker:** revert COPY paths to match CI build context ([ce2c8f9](https://github.com/maslennikov-ig/BuhBot/commit/ce2c8f974dcb4ecb536fae936a4642d61afc9025))
* **docker:** switch from pnpm to npm in Dockerfiles ([819d938](https://github.com/maslennikov-ig/BuhBot/commit/819d9383820baac2665c4dfa40666e0c082d3a4a))
* **docker:** switch frontend from Alpine to Debian slim for SWC compatibility ([07a9f60](https://github.com/maslennikov-ig/BuhBot/commit/07a9f60fd9db2f684bcf3c28e9cc40a6b7d5aa69))
* **docker:** switch to node:18-slim for Prisma OpenSSL compatibility ([fbcb551](https://github.com/maslennikov-ig/BuhBot/commit/fbcb55127c13fae8b53071f59d582ceb2b60e893))
* **docker:** use Node 18 Alpine for Prisma OpenSSL compatibility ([f2365cd](https://github.com/maslennikov-ig/BuhBot/commit/f2365cdb961b2d2d743190eaa33f6b2a8d675717))
* **docker:** use npm install --legacy-peer-deps instead of npm ci ([888aaab](https://github.com/maslennikov-ig/BuhBot/commit/888aaab0019c2fff4f0efc6ad7103747d15cd68d))
* **frontend:** add explicit left/top positioning for cursor glow ([24effc1](https://github.com/maslennikov-ig/BuhBot/commit/24effc152b35d93669969ee924bccccc8853af74))
* **frontend:** add layoutRoot for Yandex Browser compatibility ([df92fcf](https://github.com/maslennikov-ig/BuhBot/commit/df92fcff457b36ae71b0d8e937088f233863c0b2))
* **frontend:** capture supabase in variable for TypeScript narrowing ([e94b867](https://github.com/maslennikov-ig/BuhBot/commit/e94b867bb6a3bb1cfcc5b573e31853d292a40fa9))
* **frontend:** correct cursor glow positioning using useMotionValue ([962e65c](https://github.com/maslennikov-ig/BuhBot/commit/962e65c6b03aa30e4f60e87174899d4ba8c2100a))
* **frontend:** correct tRPC API path from /trpc to /api/trpc ([b819856](https://github.com/maslennikov-ig/BuhBot/commit/b81985642224e05d9f4aa1ef9f13e95fe08d5a70))
* **frontend:** fix response time chart overflow on analytics page ([5fa9ff8](https://github.com/maslennikov-ig/BuhBot/commit/5fa9ff8e38147e4b8bfe48cf1e887074703bdfcf))
* **frontend:** prevent TelegramLoginButton widget re-initialization ([98c34bf](https://github.com/maslennikov-ig/BuhBot/commit/98c34bf0191a5656dc139f0d119bb0f352f57339))
* **frontend:** replace empty string values in Select components ([922cf38](https://github.com/maslennikov-ig/BuhBot/commit/922cf38f60048b027ace0f9f7256e08dcc656598))
* **frontend:** use devMockUser from config instead of devMockSession ([4bb13d2](https://github.com/maslennikov-ig/BuhBot/commit/4bb13d2146cbc92309c8245dfe52ab10da320bf9))
* HelpButton TypeScript error ([6df3cdb](https://github.com/maslennikov-ig/BuhBot/commit/6df3cdb2f5d047ccf8e5f63b5c38a4a88c22da33))
* **imports:** use relative paths instead of aliases for build compatibility ([62e4127](https://github.com/maslennikov-ig/BuhBot/commit/62e412774a55c92e01f09f5a5f40117dd20cb02c))
* improve login page light theme support and add theme toggle ([ffaca0d](https://github.com/maslennikov-ig/BuhBot/commit/ffaca0d6ee0eae35483129463d96d934b43e5937))
* **infra:** remove security restrictions causing container crashes ([639514d](https://github.com/maslennikov-ig/BuhBot/commit/639514dd3720818b231559d3f0f8f7a38252063a))
* **lint:** resolve TypeScript and ESLint errors for CI ([5e91a99](https://github.com/maslennikov-ig/BuhBot/commit/5e91a99cbbf0897f3239f83c6981f85f87e83abe))
* **logo:** Add cache-busting version param ([61b15dc](https://github.com/maslennikov-ig/BuhBot/commit/61b15dc077fd30e11e018600119f3d073e7471db))
* **logo:** Add unoptimized to preserve PNG quality (prevent WebP conversion) ([761551e](https://github.com/maslennikov-ig/BuhBot/commit/761551e62a865ba3ecc1d5e37623aa8120d572f5))
* **logo:** Fix theme-aware logo switching and increase Header size ([dc1c3d7](https://github.com/maslennikov-ig/BuhBot/commit/dc1c3d78b03921ecd7d6425397b5941a5186258a))
* **logo:** Increase xl size to h-14 (56px) for Header logo ([5c79b0b](https://github.com/maslennikov-ig/BuhBot/commit/5c79b0bfe1e372c044ee4e0b1238c00b69e07df6))
* **logo:** Regenerate logos from source with max quality (400px, Lanczos) ([98d956d](https://github.com/maslennikov-ig/BuhBot/commit/98d956d568b36182cee804508887d4cb5686e9fe))
* **logo:** Remove query params breaking Next.js Image ([ed5cdd2](https://github.com/maslennikov-ig/BuhBot/commit/ed5cdd26eb72b394893608dc85cb1ab6c576c1fd))
* **logo:** Swap logo files so emails use light version ([0fea50b](https://github.com/maslennikov-ig/BuhBot/commit/0fea50bd4465f6ef25d20710ddd613d09496c9d8))
* Multiple UI and backend fixes ([f368c45](https://github.com/maslennikov-ig/BuhBot/commit/f368c45e837e97adf18ed1ec2b94dad35bbe9406))
* **prisma:** switch to prisma-client-js for runtime compatibility ([dbf7001](https://github.com/maslennikov-ig/BuhBot/commit/dbf7001cae2090bb09414cac18429f3384276965))
* **reports:** Add white text to modal generate button ([36cedcd](https://github.com/maslennikov-ig/BuhBot/commit/36cedcd2f9ee577b5961b92401e65aca23e48d3e))
* **reports:** Fix button text color and React hook error ([935f281](https://github.com/maslennikov-ig/BuhBot/commit/935f281ff043d65e5688bfbe8f8b5fe944730a2b))
* resolve 6 P1-P2 production bugs ([02e5827](https://github.com/maslennikov-ig/BuhBot/commit/02e582759192d644fb762089cbb28d620beef1bf))
* resolve TypeScript errors blocking CI ([3739160](https://github.com/maslennikov-ig/BuhBot/commit/37391604526a2613542a3d85cd40672a0723e263))
* **security:** update Next.js to 16.0.10 - CVE-2025-55182/CVE-2025-66478 ([e3e69ca](https://github.com/maslennikov-ig/BuhBot/commit/e3e69ca3ae4a5d471961efd885edf30a3902ff38))
* **sidebar:** Don't highlight parent nav when child is active ([344ec77](https://github.com/maslennikov-ig/BuhBot/commit/344ec77229debe77de761e340326d4f1a0a8ccd2))
* **sidebar:** Simplify active nav item logic ([4db5631](https://github.com/maslennikov-ig/BuhBot/commit/4db56311dc1ea71e58db50501d6f55a21bc3a24d))
* SLA timer now stops on accountant response + dropdown menu visibility ([657da82](https://github.com/maslennikov-ig/BuhBot/commit/657da828c38615e3292ce14d4dbfa2723029b0d4))
* **sla:** complete SLA notification system fixes and testing ([9e6532a](https://github.com/maslennikov-ig/BuhBot/commit/9e6532af88db1f04792149b2762b1a5f3ab96a01))
* **sla:** fix notifyInChatOnBreach and global threshold update (gh-16, gh-17) ([6d4cca9](https://github.com/maslennikov-ig/BuhBot/commit/6d4cca940d32a46d4a8be46b067b1d5419c00ddf))
* **sla:** initialize BullMQ workers for SLA monitoring ([70f1698](https://github.com/maslennikov-ig/BuhBot/commit/70f1698762d7d238d9f323de4d90e97cb72c6ee0))
* **sla:** use IN operator for enum comparison in Prisma 7 ([f923928](https://github.com/maslennikov-ig/BuhBot/commit/f923928407bc63e60c9d917103cee3ae225efe68))
* sync package-lock.json with new dependencies ([19a799d](https://github.com/maslennikov-ig/BuhBot/commit/19a799dce40d01a8a3b7f4116a7d92e1f5702a9d))
* **test:** fix ESLint errors in sla-timer.worker.test.ts ([25b3bb3](https://github.com/maslennikov-ig/BuhBot/commit/25b3bb3d35f1885ee1cadd6d1e9d098f856c22ec))
* **types:** add explicit ClientRequest type to response handler ([5fbdabb](https://github.com/maslennikov-ig/BuhBot/commit/5fbdabb894fe9ec5a4de2704918b381514e13d1c))
* **types:** convert Prisma bigint to number in tRPC routers ([a87406a](https://github.com/maslennikov-ig/BuhBot/commit/a87406a635815fa05b822ec1936db69256b75fb4))
* **ui:** Add popover/dropdown background colors to theme ([8e36629](https://github.com/maslennikov-ig/BuhBot/commit/8e36629ece898f5304755df163edbe61d3326e6b))
* **ui:** Fix tabs styling and translate to Russian ([ba70489](https://github.com/maslennikov-ig/BuhBot/commit/ba70489df3563efb6f628276b80ec11eb96ff3dc))
* **ui:** Restyle AlertsPage to match project design system ([96957df](https://github.com/maslennikov-ig/BuhBot/commit/96957df08097dd900925296e6cc5d337d7b5380f))
* **ui:** Rewrite AlertsPage to match Chats page structure ([5076b30](https://github.com/maslennikov-ig/BuhBot/commit/5076b30299fc3baf761bcc64a69547113c9b25e8))
* use const for finalUsernames (lint error) ([96f4d92](https://github.com/maslennikov-ig/BuhBot/commit/96f4d92da6d8bc1a6194f612f9ee653a7e54df2c))
* **users:** allow selecting admins as accountants ([3c0e188](https://github.com/maslennikov-ig/BuhBot/commit/3c0e188624614ed07f615b6084957a3ddfaeabdd))
* **webhook:** skip express.json() for Telegram webhook path ([1cb266b](https://github.com/maslennikov-ig/BuhBot/commit/1cb266bf36298e6c22c24b0d4419fe65efcf484f))
* **webhook:** use explicit POST route for Telegraf middleware ([f2081af](https://github.com/maslennikov-ig/BuhBot/commit/f2081af80244867314867e5b1013142531f21ae9))

## [Unreleased]

## [0.14.8] - 2026-02-21

### Fixed
- **backend**: harden migration and chat list (gh-185) (8c1ece2)

## [0.14.6] - 2026-02-21

### Fixed
- **backend**: add bigint conversions, disable error_logs rls (baf9cb3)
- **backend**: resolve missing chat messages (gh-185) (56aa3ba)

### Other
- **main**: release buhbot 0.14.5 (#183) (062ef3b)

## [0.9.19] - 2026-01-30

### Fixed

- **sla**: fix notifyInChatOnBreach and global threshold update (gh-16, gh-17) (6d4cca9)

### Other

- bd sync: 2026-01-30 16:15:39 (073a3b1)
- bd sync: 2026-01-30 16:15:23 (c7e938e)
- **sla**: add timer service unit tests (0316ae9)

## [0.9.18] - 2026-01-30

### Added

- add 1 skill(s), update docs (40c751a)
- implement 4 GitHub issues (gh-8, gh-12, gh-13, gh-15) (a1caee9)

### Changed

- **queues**: centralize BullMQ configuration in queue.config.ts (buh-xch) (2fc9c86)

### Fixed

- resolve 6 P1-P2 production bugs (02e5827)
- **frontend**: fix response time chart overflow on analytics page (5fa9ff8)
- **frontend**: replace empty string values in Select components (922cf38)
- **docker**: revert COPY paths to match CI build context (ce2c8f9)
- **deps**: add winston-transport as direct dependency (15f713f)
- **lint**: resolve TypeScript and ESLint errors for CI (5e91a99)

### Other

- bd sync: 2026-01-30 13:53:46 (5e51087)
- bd sync: 2026-01-30 13:53:20 (013e833)
- bd sync: 2026-01-30 13:26:29 (62901a5)
- bd sync: 2026-01-30 13:25:36 (58e3b22)
- bd sync: 2026-01-30 13:10:32 (60ced73)
- bd sync: 2026-01-30 13:09:26 (b5c4cb5)

## [0.9.17] - 2026-01-16

### Added

- **navigation**: add System Logs item to AdminLayout (buh-xla) (0e8a4f3)
- **frontend**: add complete logs/errors UI with pages and components (buh-mgs, buh-brr) (3fe4d8e)
- **api**: add tRPC logs router for error logs management (buh-zdc) (5e3be7e)
- **logging**: add ErrorCaptureService with MD5 fingerprinting (buh-65g) (8e68351)

### Fixed

- **imports**: use relative paths instead of aliases for build compatibility (62e4127)
- **docker**: add backend/ prefix to COPY paths for correct build context (9173e0d)

### Other

- update docs (c04a5b6)
- bd sync: 2026-01-16 14:35:04 (0229d86)
- bd sync: 2026-01-16 14:32:15 (7b47149)
- bd sync: 2026-01-16 14:30:58 (1a17557)
- bd sync: 2026-01-16 14:29:59 (9a14d9c)
- bd sync: 2026-01-16 14:20:48 (8dea97a)
- bd sync: 2026-01-16 14:15:40 (49a70e5)
- bd sync: 2026-01-16 14:15:29 (474f35d)

## [0.9.16] - 2026-01-16

### Added

- **database**: add ErrorLog model for centralized error tracking (buh-oyj) (7830439)

### Other

- update docs (64ef484)
- bd sync: 2026-01-16 14:05:08 (9ae6e83)
- bd sync: 2026-01-16 14:05:01 (ee91587)

## [0.9.15] - 2026-01-16

### Added

- **.claude/skills/systematic-debugging/condition-based-waiting-example.ts**: add 17 source file(s), add 4 agent(s), +7 more (7cc7cdc)
- add invite_link to Chat model for universal 'Open chat' button support (buh-8tp) (fbf8510)
- notify all accountants from accountantUsernames array (buh-k5a) (484d21f)
- **ci**: add Telegram notification on CI failure (585f6cd)

### Fixed

- **alerts**: send notification to accountant DM instead of group (3b34954)
- **alerts**: use assignedAccountant relation for notify button (5828296)
- **sla**: complete SLA notification system fixes and testing (9e6532a)
- use const for finalUsernames (lint error) (96f4d92)
- auto-add accountant username when assigned via dropdown (65cd4c9)
- **ci**: use lowercase repository name for Docker image tags (ceb08ef)

### Other

- bd sync: 2026-01-16 12:43:49 (61d2fa2)
- bd sync: 2026-01-14 16:45:52 (f62d7db)
- bd sync: 2026-01-14 16:45:34 (e5317aa)
- bd sync: 2026-01-14 16:42:26 (a2e079d)
- bd sync: 2026-01-14 16:17:58 (3e909a4)
- bd sync: 2026-01-14 16:05:52 (71d52d3)
- bd sync: 2026-01-14 15:59:53 (77f05f1)
- bd sync: 2026-01-14 13:40:41 (ad52b54)

## [0.9.14] - 2025-12-25

## [0.9.13] - 2025-12-25

## [0.9.12] - 2025-12-20

### Added

- **deploy**: add pre-flight checks for dependencies and ports (b78cac2)

## [0.9.11] - 2025-12-20

### Fixed

- **ci**: skip telegram notification when deploy is skipped (72ddd72)

## [0.9.10] - 2025-12-20

## [0.9.9] - 2025-12-20

### Added

- **accountants**: add multiple accountant usernames support (8587966)
- **api**: add accountantUsernames array support to chats router (048bf1c)
- **requests**: show accountant response in requests table (2b1b06d)

### Fixed

- **api**: cascade delete chat_message when deleting client_request (5c0a272)

## [0.9.8] - 2025-12-18

### Fixed

- **api**: remove direction param conflict with tRPC infinite query (1d199fa)
- **ci**: sync backend package-lock.json with npm (not pnpm) (0e831df)
- **ci**: regenerate backend package-lock.json for Docker build (bb9175d)

## [0.9.7] - 2025-12-17

### Added

- **agents**: add supabase-fixer agent (7ab2cfe)

### Fixed

- **sla**: use IN operator for enum comparison in Prisma 7 (f923928)

## [0.9.6] - 2025-12-17

### Added

- **sla**: add SLA timer recovery on server restart (e01bacf)

### Fixed

- **webhook**: use explicit POST route for Telegraf middleware (f2081af)
- **webhook**: skip express.json() for Telegram webhook path (1cb266b)
- **deploy**: use pre-built Docker images instead of building on deploy (06718c3)

## [0.9.5] - 2025-12-16

### Added

- **classifier**: improve Russian classification prompt with few-shot examples (dd57b75)

## [0.9.4] - 2025-12-16

### Added

- add chat delete functionality (aa16d15)
- **frontend**: add action buttons for requests management (8fcb1c2)
- **frontend**: add request details page /requests/[id] (6f18dff)

### Fixed

- SLA timer now stops on accountant response + dropdown menu visibility (657da82)
- **bot**: improve accountant detection using User table (7ef66e1)
- **ci**: exclude Docker-created dirs from rsync sync (f130a3d)
- **docker**: switch frontend from Alpine to Debian slim for SWC compatibility (07a9f60)
- **ci**: remove frontend pnpm-lock.yaml for npm-based Docker build (81dc4ec)
- **ci**: sync backend package-lock.json for Docker build (0230312)
- **ci**: resolve ESLint error and sync frontend lock file (7f46e78)

## [0.9.3] - 2025-12-16

### Added

- **classifier**: add metrics, circuit breaker, and message filtering (e152d29)

### Fixed

- **types**: add explicit ClientRequest type to response handler (5fbdabb)
- **docker**: use npm install --legacy-peer-deps instead of npm ci (888aaab)
- **backend**: resolve all audit issues (P0-P3) (7364984)
- **sla**: initialize BullMQ workers for SLA monitoring (70f1698)
- **security**: update Next.js to 16.0.10 - CVE-2025-55182/CVE-2025-66478 (e3e69ca)
- **analytics**: use z.coerce.date() for all date inputs in tRPC (18cb31e)
- resolve TypeScript errors blocking CI (3739160)

## [0.9.2] - 2025-12-14

### Security

- harden frontend container limits and fs permissions (1d8dad9)

### Fixed

- change User.role from enum to String for DB compatibility (5ce7ff0)
- add IPv4-first DNS resolution and diagnostic logging (342e1c3)
- **users**: allow selecting admins as accountants (3c0e188)
- **chats**: enforce strict BOT_USERNAME check for invitations (d60cb8f)

## [0.9.1] - 2025-12-14

### Fixed

- **bot**: enable polling fallback in prod, fix accountant select, add /info command (fc3a244)

## [0.9.0] - 2025-12-14

### Added

- **bot**: add /help command handler (36485d3)

### Changed

- **deploy**: use workflow_run trigger instead of wait-on-check (0dbaf9f)

### Fixed

- **config**: require BOT_USERNAME env var for deep links (7f03672)
- **bot**: reorder handler registration for /menu and /template commands (983c2c8)
- **bot**: correct webhook middleware integration with Express (a031268)
- **bot**: use createWebhook instead of webhookCallback (5436f83)
- **bot**: register webhook route before 404 handler (e5ff392)
- **deploy**: add SSH keepalive to prevent connection timeout (fb1c0eb)
- **deploy**: use root context for frontend Docker build (6c6842e)
- **deploy**: increase wait-on-check timeout to 15 minutes (ca4b9f9)
- **ci**: use default import for logger (b7ee219)
- **ci**: fix eslint errors in notification, user routers and invitation handler (8c4d983)
- **ci**: update pnpm-lock.yaml to include tsx dependency (3f43c80)
- **deploy**: fix secrets context not allowed in step if condition (4f9ef28)
- **ci**: remove CRLF line endings from workflow files (890d2d8)
- **deploy**: update production URL to buhbot.aidevteam.ru (dab885c)

## [0.8.3] - 2025-12-10

### Fixed

- **bot**: integrate Telegram bot initialization into backend entry point (c5b93a9)

## [0.8.2] - 2025-12-04

## [0.8.1] - 2025-12-04

## [0.8.0] - 2025-12-04

### Added

- **hero**: Add light theme and 8 chat scenarios to HeroChatMockup (429a3a6)
- **branding**: Add light theme logo + increase Hero text size (470e29b)
- **landing**: Add animated chat mockup to Hero section (cf6a3ec)
- **branding**: Add logo image to Header, Footer, Auth pages (63e51f0)

### Fixed

- Multiple UI and backend fixes (f368c45)
- **auth**: Fix deleteUser enum type mismatch with Prisma pg-adapter (0dc137f)
- **logo**: Add unoptimized to preserve PNG quality (prevent WebP conversion) (761551e)
- **logo**: Regenerate logos from source with max quality (400px, Lanczos) (98d956d)
- **logo**: Remove query params breaking Next.js Image (ed5cdd2)
- **logo**: Add cache-busting version param (61b15dc)
- **logo**: Swap logo files so emails use light version (0fea50b)
- **logo**: Increase xl size to h-14 (56px) for Header logo (5c79b0b)
- **logo**: Fix theme-aware logo switching and increase Header size (dc1c3d7)

## [0.7.2] - 2025-12-03

## [0.7.1] - 2025-12-03

## [0.7.0] - 2025-12-03

### Added

- **auth**: Add user invitation flow with Supabase Auth (66b8a4b)
- **users**: Add full user management for admins (c43cc82)

### Fixed

- **auth**: Wrap SetPasswordForm in Suspense boundary (d938b2b)
- **dashboard**: Add violations chart data to dashboard widget (2043ad6)

## [0.6.3] - 2025-12-02

## [0.6.2] - 2025-12-02

### Added

- **reports**: Implement reports section with export functionality (fefa74a)
- add Violations and Help menu items, create Help page (162f266)

### Fixed

- **ui**: Fix tabs styling and translate to Russian (ba70489)
- **reports**: Add white text to modal generate button (36cedcd)
- **api**: Use z.coerce.date() for exportReport input (0be12b6)
- **reports**: Fix button text color and React hook error (935f281)
- **ui**: Add popover/dropdown background colors to theme (8e36629)
- HelpButton TypeScript error (6df3cdb)
- sync package-lock.json with new dependencies (19a799d)

## [0.6.1] - 2025-12-02

## [0.6.0] - 2025-11-30

### Added

- **analytics**: Add response time analytics page and table sorting (1f5698a)
- **notifications**: Link SLA alerts to in-app notifications (8532bb2)

### Fixed

- **sidebar**: Simplify active nav item logic (4db5631)
- **sidebar**: Don't highlight parent nav when child is active (344ec77)
- **alerts**: Use actual data for quick stats counters (14cb6d6)
- **ui**: Rewrite AlertsPage to match Chats page structure (5076b30)
- **ui**: Restyle AlertsPage to match project design system (96957df)

## [0.5.0] - 2025-11-30

## [0.4.0] - 2025-11-29

### Added

- **007**: Implement Admin CRUD Pages (1cd27c7)

### Fixed

- **007**: Implement shadcn Select component (f797340)
- **007**: Code review improvements (dd27da5)

## [0.3.0] - 2025-11-27

### Added

- **telegram**: implement Telegram Login integration (006) (d3f3fdc)

### Fixed

- **frontend**: prevent TelegramLoginButton widget re-initialization (98c34bf)
- **docker**: add NEXT_PUBLIC_BOT_NAME build arg for Telegram Login (2987869)

## [0.2.9] - 2025-11-27

## [0.2.9] - 2025-11-27

### Added

- **frontend**: add separate Profile settings page (`/settings/profile`) with personal data editing
- **frontend**: add "Connect Telegram" UI in profile settings
- **backend**: add `telegram_id` and `telegram_username` fields to User model (T002)
- **backend**: implement `auth.updateProfile` tRPC procedure

## [0.2.8] - 2025-11-27

### Changed

- **frontend**: unify ProfileMenu component for landing and dashboard

### Added

- implement robust theme management with next-themes (281c102)
- add password visibility toggle and fix light mode visibility in login (9a6cf15)

### Changed

- replace custom ThemeContext with next-themes in AdminLayout (0e6f139)

### Fixed

- improve login page light theme support and add theme toggle (ffaca0d)

## [0.2.6] - 2025-11-25

### Fixed

- **frontend**: add layoutRoot for Yandex Browser compatibility (df92fcf)
- **frontend**: add explicit left/top positioning for cursor glow (24effc1)

## [0.2.5] - 2025-11-25

### Fixed

- **frontend**: correct cursor glow positioning using useMotionValue (962e65c)

## [0.2.4] - 2025-11-25

### Fixed

- **frontend**: correct tRPC API path from /trpc to /api/trpc (b819856)
- **backend**: use raw SQL for contact insert as workaround for Prisma 7 UUID bug (1797ec7)
- **backend**: remove @default from GlobalSettings.id to fix UUID parsing (c4afc01)

## [0.2.3] - 2025-11-25

### Added

- **backend**: integrate tRPC Express adapter (a6c0d39)

### Fixed

- **backend**: add .js extensions to tRPC imports for ESM compatibility (5f13d91)
- **backend**: convert undefined to null for contact notification payload (47ba96d)
- **backend**: use bracket notation for env var access to satisfy TypeScript strict mode (22671f4)

## [0.2.2] - 2025-11-25

### Added

- **landing**: add section IDs for smooth scroll navigation (bc3b02a)

## [0.2.1] - 2025-11-24

### Fixed

- **prisma**: switch to prisma-client-js for runtime compatibility (dbf7001)
- **build**: include Prisma generated files in TypeScript compilation (2e3ecc3)
- **docker**: regenerate Prisma client in runtime stage (24e607b)
- **docker**: add --legacy-peer-deps for React 19 compatibility (efacfe7)
- **docker**: change frontend build context to repo root (270d792)
- **docker**: switch from pnpm to npm in Dockerfiles (819d938)

## [0.2.0] - 2025-11-24

## [0.1.22] - 2025-11-24

## [0.1.21] - 2025-11-24

## [0.1.20] - 2025-11-24

## [0.1.19] - 2025-11-24

## [0.1.18] - 2025-11-24

## [0.1.17] - 2025-11-24

### Added

- SLA Monitoring System (MODULE 1.1) (#2) (f1f5a7a)
- **deps**: migrate Prisma 5.22 to 7.0 (785e16e)

## [0.1.16] - 2025-11-22

## [0.1.15] - 2025-11-22

## [0.1.14] - 2025-11-22

## [0.1.13] - 2025-11-22

## [0.1.12] - 2025-11-22

## [0.1.11] - 2025-11-22

### Fixed

- **docker**: switch to node:18-slim for Prisma OpenSSL compatibility (fbcb551)
- **docker**: use Node 18 Alpine for Prisma OpenSSL compatibility (f2365cd)
- **infra**: remove security restrictions causing container crashes (639514d)
- **types**: convert Prisma bigint to number in tRPC routers (a87406a)
- **docker**: add package-lock.json for npm ci builds (347430f)

## [0.1.10] - 2025-11-20

## [0.1.9] - 2025-11-20

## [0.1.8] - 2025-11-20

## [0.1.7] - 2025-11-20

### Added

- **agents**: add nextjs-ui-designer agent (04fd327)

## [0.1.6] - 2025-11-17

### Added

- **backend**: complete Phase 3 - Supabase database setup (142ca9f)

## [0.1.5] - 2025-11-17

## [0.1.4] - 2025-11-17

## [0.1.3] - 2025-11-17

### Added

- **infrastructure**: complete Phase 1 Setup - project initialization (7988d84)

## [0.1.2] - 2025-11-17

### Added

- **agents**: create 8 infrastructure worker agents for BuhBot deployment (5b01434)

## [0.1.1] - 2025-11-17

## [0.1.0] - 2025-11-17

### Added

- Initial repository setup
- Project naming: **BuhBot** (платформа автоматизации коммуникаций для бухгалтерских фирм)
- README.md with project overview and roadmap
- Complete project documentation (Technical Specification, Modular Offer)
- Claude Code orchestration rules (CLAUDE.md)
- Git repository initialization with GitHub remote
- 152-ФЗ compliance architecture planning
- 3-phase development roadmap

### Documentation

- Technical Specification v1.2
- Final Modular Offer with Hours breakdown
- DeepResearch Analysis for TG Bot Features
- Agent Ecosystem documentation
- Executive Summary
