# Graph Report - juchess-platform  (2026-07-05)

## Corpus Check
- 77 files · ~587,552 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 681 nodes · 882 edges · 56 communities (46 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `976f6de4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_main.dart|main.dart]]
- [[_COMMUNITY_Win32Window|Win32Window]]
- [[_COMMUNITY_support.js|support.js]]
- [[_COMMUNITY_support.js|support.js]]
- [[_COMMUNITY_appwrite.ts|appwrite.ts]]
- [[_COMMUNITY_StatelessWidget|StatelessWidget]]
- [[_COMMUNITY_my_application.cc|my_application.cc]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_wWinMain|wWinMain]]
- [[_COMMUNITY_data.js|data.js]]
- [[_COMMUNITY_manifest.json|manifest.json]]
- [[_COMMUNITY_GeneratedPluginRegistrant.swift|GeneratedPluginRegistrant.swift]]
- [[_COMMUNITY_AppDelegate|AppDelegate]]
- [[_COMMUNITY_appwrite.ts|appwrite.ts]]
- [[_COMMUNITY_juchess.ts|juchess.ts]]
- [[_COMMUNITY_RunnerTests.swift|RunnerTests.swift]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_.oxlintrc.json|.oxlintrc.json]]
- [[_COMMUNITY_juchess.ts|juchess.ts]]
- [[_COMMUNITY_GeneratedPluginRegistrant|GeneratedPluginRegistrant]]
- [[_COMMUNITY_handle_new_rx_page|handle_new_rx_page]]
- [[_COMMUNITY_RegisterGeneratedPlugins|RegisterGeneratedPlugins]]
- [[_COMMUNITY_RunnerTests.swift|RunnerTests.swift]]
- [[_COMMUNITY_AppDelegate|AppDelegate]]
- [[_COMMUNITY_.oxlintrc.json|.oxlintrc.json]]
- [[_COMMUNITY_GeneratedPluginRegistrant|GeneratedPluginRegistrant]]
- [[_COMMUNITY_RunnerTests|RunnerTests]]
- [[_COMMUNITY_AppState|AppState]]
- [[_COMMUNITY_widget_test.dart|widget_test.dart]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_MainActivity|MainActivity]]
- [[_COMMUNITY_App.tsx|App.tsx]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_flutter_export_environment.sh|flutter_export_environment.sh]]
- [[_COMMUNITY_flutter_export_environment.sh|flutter_export_environment.sh]]
- [[_COMMUNITY_main.js|main.js]]
- [[_COMMUNITY_String|String?]]
- [[_COMMUNITY_Tables|Tables]]
- [[_COMMUNITY_JuChess Project Status|JuChess Project Status]]
- [[_COMMUNITY_JuChess Platform|JuChess Platform]]
- [[_COMMUNITY_JuChess Prototype Screen Checklist|JuChess Prototype Screen Checklist]]
- [[_COMMUNITY_React + TypeScript + Vite|React + TypeScript + Vite]]
- [[_COMMUNITY_React + TypeScript + Vite|React + TypeScript + Vite]]
- [[_COMMUNITY_juchess_mobile|juchess_mobile]]
- [[_COMMUNITY_README|README.md]]

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

## Communities (56 total, 10 thin omitted)

### Community 0 - "main.dart"
Cohesion: 0.03
Nodes (69): Account, account, action, AppConfig, AppwriteService, burgundy, cardDecoration, child (+61 more)

### Community 1 - "Win32Window"
Cohesion: 0.06
Nodes (53): RegisterPlugins(), DartProject, HWND, LPARAM, LRESULT, UINT, WPARAM, FlutterWindow (+45 more)

### Community 2 - "support.js"
Cohesion: 0.08
Nodes (44): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules(), createHelmetManager() (+36 more)

### Community 3 - "support.js"
Cohesion: 0.08
Nodes (44): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules(), createHelmetManager() (+36 more)

### Community 4 - "appwrite.ts"
Cohesion: 0.05
Nodes (36): dependencies, appwrite, lucide-react, react, react-dom, react-router-dom, devDependencies, oxlint (+28 more)

### Community 5 - "StatelessWidget"
Cohesion: 0.07
Nodes (27): AppScroll, BigActionCard, ChipPill, FeaturedTournamentCard, GamesScreen, GoldPill, GuestCard, GuestPill (+19 more)

### Community 6 - "my_application.cc"
Cohesion: 0.09
Nodes (22): fl_register_plugins(), main(), first_frame_cb(), my_application_activate(), my_application_class_init(), my_application_dispose(), my_application_init(), my_application_local_command_line() (+14 more)

### Community 7 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 9 - "devDependencies"
Cohesion: 0.11
Nodes (17): devDependencies, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+9 more)

### Community 10 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "scripts"
Cohesion: 0.13
Nodes (14): name, private, scripts, build:admin, build:web, dev:admin, dev:web, lint:admin (+6 more)

### Community 13 - "wWinMain"
Cohesion: 0.24
Nodes (9): wWinMain(), string, wchar_t, CreateAndAttachConsole(), GetCommandLineArguments(), Utf8FromUtf16(), _In_, _In_opt_ (+1 more)

### Community 14 - "data.js"
Cohesion: 0.35
Nodes (10): buildRounds(), circle(), fromBracket(), G(), live(), mkGame(), nameRating(), P() (+2 more)

### Community 15 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, prefer_related_applications, short_name (+2 more)

### Community 16 - "GeneratedPluginRegistrant.swift"
Cohesion: 0.28
Nodes (7): desktop_webview_window, device_info_plus, flutter_web_auth_2, Foundation, package_info_plus, url_launcher_macos, window_to_front

### Community 17 - "AppDelegate"
Cohesion: 0.25
Nodes (6): Any, AppDelegate, Bool, FlutterImplicitEngineBridge, FlutterImplicitEngineDelegate, UIApplication

### Community 18 - "appwrite.ts"
Cohesion: 0.25
Nodes (7): account, appwriteConfig, appwriteReady, client, functions, storage, tablesDB

### Community 19 - "juchess.ts"
Cohesion: 0.25
Nodes (7): liveGames, Member, members, tableIds, Tournament, tournaments, TournamentStatus

### Community 20 - "RunnerTests.swift"
Cohesion: 0.38
Nodes (4): SceneDelegate, Flutter, FlutterSceneDelegate, UIKit

### Community 21 - "package.json"
Cohesion: 0.29
Nodes (6): dependencies, node-appwrite, name, private, type, version

### Community 22 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 23 - "juchess.ts"
Cohesion: 0.33
Nodes (5): adminQueues, tableIds, Tournament, tournaments, TournamentStatus

### Community 24 - "GeneratedPluginRegistrant"
Cohesion: 0.47
Nodes (4): GeneratedPluginRegistrant, String, FlutterEngine, Keep

### Community 25 - "handle_new_rx_page"
Cohesion: 0.33
Nodes (5): handle_new_rx_page(), __lldb_init_module(), Intercept NOTIFY_DEBUGGER_ABOUT_RX_PAGES and touch the pages., SBDebugger, SBFrame

### Community 26 - "RegisterGeneratedPlugins"
Cohesion: 0.33
Nodes (5): RegisterGeneratedPlugins(), MainFlutterWindow, FlutterPluginRegistry, FlutterViewController, NSWindow

### Community 27 - "RunnerTests.swift"
Cohesion: 0.47
Nodes (3): Cocoa, FlutterMacOS, XCTest

### Community 28 - "AppDelegate"
Cohesion: 0.47
Nodes (4): AppDelegate, Bool, FlutterAppDelegate, NSApplication

### Community 29 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 30 - "GeneratedPluginRegistrant"
Cohesion: 0.40
Nodes (3): GeneratedPluginRegistrant, +registerWithRegistry, NSObject

### Community 31 - "RunnerTests"
Cohesion: 0.40
Nodes (3): RunnerTests, RunnerTests, XCTestCase

### Community 32 - "AppState"
Cohesion: 0.40
Nodes (5): AppState, build, HomeScreen, PrototypeShell, ChangeNotifier

### Community 33 - "widget_test.dart"
Cohesion: 0.50
Nodes (3): main, package:flutter_test/flutter_test.dart, package:juchess_mobile/main.dart

### Community 48 - "Tables"
Cohesion: 0.12
Nodes (15): `admin_audit`, `announcements`, Auth And Teams, `avatars`, First Server Function, `games`, JuChess Appwrite Schema, `profiles` (+7 more)

### Community 49 - "JuChess Project Status"
Cohesion: 0.25
Nodes (7): Appwrite Boundary, Current Technical State, Current Workspace, Immediate Next Work, JuChess Project Status, Non-Negotiable Product Rule, Verified So Far

### Community 50 - "JuChess Platform"
Cohesion: 0.29
Nodes (6): Apps, Appwrite Setup, Current Implementation Slice, JuChess Platform, Local Commands, Product Rule

### Community 51 - "JuChess Prototype Screen Checklist"
Cohesion: 0.33
Nodes (5): Acceptance Rule, Admin App, JuChess Prototype Screen Checklist, Mobile And Tablet App, Web App

### Community 52 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 53 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **276 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+271 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FlutterWindow` connect `Win32Window` to `RegisterGeneratedPlugins`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `RegisterGeneratedPlugins()` connect `RegisterGeneratedPlugins` to `GeneratedPluginRegistrant.swift`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _277 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.02857142857142857 - nodes in this community are weakly interconnected._
- **Should `Win32Window` be split into smaller, more focused modules?**
  _Cohesion score 0.0597567424643046 - nodes in this community are weakly interconnected._
- **Should `support.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07597402597402597 - nodes in this community are weakly interconnected._
- **Should `support.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07597402597402597 - nodes in this community are weakly interconnected._