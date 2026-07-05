# Graph Report - C:\Users\ibra_\Downloads\juchess-platform  (2026-07-05)

## Corpus Check
- 155 files · ~227,371 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 618 nodes · 829 edges · 48 communities (40 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `Win32Window` - 22 edges
2. `compilerOptions` - 18 edges
3. `compilerOptions` - 18 edges
4. `compilerOptions` - 15 edges
5. `compilerOptions` - 15 edges
6. `MessageHandler` - 12 edges
7. `FlutterWindow` - 10 edges
8. `Create` - 10 edges
9. `WndProc` - 10 edges
10. `createRuntime()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `wWinMain()` --calls--> `CreateAndAttachConsole()`  [INFERRED]
  apps/mobile/windows/runner/main.cpp → apps/mobile/windows/runner/utils.cpp
- `Win32Window::Win32Window()` --calls--> `Destroy`  [INFERRED]
  apps/mobile/windows/runner/win32_window.cpp → apps/mobile/windows/runner/win32_window.h
- `my_application_activate()` --calls--> `fl_register_plugins()`  [INFERRED]
  apps/mobile/linux/runner/my_application.cc → apps/mobile/linux/flutter/generated_plugin_registrant.cc
- `main()` --calls--> `my_application_new()`  [INFERRED]
  apps/mobile/linux/runner/main.cc → apps/mobile/linux/runner/my_application.cc
- `OnCreate` --calls--> `RegisterPlugins()`  [INFERRED]
  apps/mobile/windows/runner/flutter_window.h → apps/mobile/windows/flutter/generated_plugin_registrant.cc

## Import Cycles
- None detected.

## Communities (48 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (69): Account, account, action, AppConfig, AppwriteService, burgundy, cardDecoration, child (+61 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (53): RegisterPlugins(), DartProject, HWND, LPARAM, LRESULT, UINT, WPARAM, FlutterWindow (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (44): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules(), createHelmetManager() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (44): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules(), createHelmetManager() (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (36): dependencies, appwrite, lucide-react, react, react-dom, react-router-dom, dependencies, appwrite (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (27): AppScroll, BigActionCard, ChipPill, FeaturedTournamentCard, GamesScreen, GoldPill, GuestCard, GuestPill (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (22): fl_register_plugins(), main(), first_frame_cb(), my_application_activate(), my_application_class_init(), my_application_dispose(), my_application_init(), my_application_local_command_line() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (17): devDependencies, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): name, private, scripts, build:admin, build:web, dev:admin, dev:web, lint:admin (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.24
Nodes (9): wWinMain(), string, wchar_t, CreateAndAttachConsole(), GetCommandLineArguments(), Utf8FromUtf16(), _In_, _In_opt_ (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.35
Nodes (10): buildRounds(), circle(), fromBracket(), G(), live(), mkGame(), nameRating(), P() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, prefer_related_applications, short_name (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.28
Nodes (7): desktop_webview_window, device_info_plus, flutter_web_auth_2, Foundation, package_info_plus, url_launcher_macos, window_to_front

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (6): Any, AppDelegate, Bool, FlutterImplicitEngineBridge, FlutterImplicitEngineDelegate, UIApplication

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (7): account, appwriteConfig, appwriteReady, client, functions, storage, tablesDB

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): liveGames, Member, members, tableIds, Tournament, tournaments, TournamentStatus

### Community 20 - "Community 20"
Cohesion: 0.38
Nodes (4): SceneDelegate, Flutter, FlutterSceneDelegate, UIKit

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (6): dependencies, node-appwrite, name, private, type, version

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (5): adminQueues, tableIds, Tournament, tournaments, TournamentStatus

### Community 24 - "Community 24"
Cohesion: 0.47
Nodes (4): GeneratedPluginRegistrant, String, FlutterEngine, Keep

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (5): handle_new_rx_page(), __lldb_init_module(), Intercept NOTIFY_DEBUGGER_ABOUT_RX_PAGES and touch the pages., SBDebugger, SBFrame

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (5): RegisterGeneratedPlugins(), MainFlutterWindow, FlutterPluginRegistry, FlutterViewController, NSWindow

### Community 27 - "Community 27"
Cohesion: 0.47
Nodes (3): Cocoa, FlutterMacOS, XCTest

### Community 28 - "Community 28"
Cohesion: 0.47
Nodes (4): AppDelegate, Bool, FlutterAppDelegate, NSApplication

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 30 - "Community 30"
Cohesion: 0.40
Nodes (3): GeneratedPluginRegistrant, +registerWithRegistry, NSObject

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (3): RunnerTests, RunnerTests, XCTestCase

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (5): AppState, build, HomeScreen, PrototypeShell, ChangeNotifier

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): main, package:flutter_test/flutter_test.dart, package:juchess_mobile/main.dart

## Knowledge Gaps
- **240 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FlutterWindow` connect `Community 1` to `Community 26`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `RegisterGeneratedPlugins()` connect `Community 26` to `Community 16`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02857142857142857 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0597567424643046 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07597402597402597 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07597402597402597 - nodes in this community are weakly interconnected._