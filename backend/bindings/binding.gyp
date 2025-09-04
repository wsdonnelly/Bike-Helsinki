{
  "targets": [
    {
      "target_name": "kd_snap",
      "sources": [ "kd_snap.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/opt/homebrew/include",
        "../../data",
        "../../injest"
      ],
      'dependencies': [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except_all",
      ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags_cc": [
        "-std=c++17",
        "-fexceptions"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS=0"
      ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17"
      },
      "defines": [ "NAPI_CPP_EXCEPTIONS" ]
    },
    {
      "target_name": "route",
      "sources": [ "route.cpp" ],
            "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/opt/homebrew/include",
        "../../data",
        "../../injest"
      ],
      'dependencies': [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except_all",
      ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags_cc": [
        "-std=c++17",
        "-fexceptions"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS=0"
      ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17"
      },
      "defines": [ "NAPI_CPP_EXCEPTIONS" ]
    }
  ]
}
