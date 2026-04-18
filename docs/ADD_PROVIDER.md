# Add a New API Provider

本指南用于在 Video Pipeline Studio 中接入新的大模型 API 提供方。

## 1) 实现 Provider 适配器

在 `src/video_pipeline_studio/core/providers/` 新建实现类，继承 `BaseProvider`：

- 必选：
  - `test_connection()`
  - `chat()`
- 按能力可选：
  - `list_models()`
  - `create_embeddings()`
  - `rerank()`

建议将厂商错误映射到统一异常：
- `ProviderRequestError`
- `ProviderTransientError`

## 2) 注册到 Registry

编辑 `src/video_pipeline_studio/core/providers/registry.py`：

1. 在 `create_default_registry()` 添加 `registry.register(...)`
2. `provider_kind` 与 settings 中的 profile.kind 保持一致

## 3) 在设置页补充配置入口

编辑 `pages/0_settings.py`：

- 在 Provider Profiles 管理区增加 `provider_kind` 选项
- 按能力设置可配置字段（API Key、Base URL、默认模型）
- 使用 “测试当前 Provider（Registry）” 验证连通性

## 4) 补测试与回归

最少验证：

1. 页面语法检查：
   - `python3 -m py_compile pages/0_settings.py pages/3_creator_workspace.py`
2. QA 全量：
   - `python3 tests/e2e_qa.py`
3. 手工连通：
   - 设置页新增 profile -> 测试连接
   - 创作页选择对应模型并生成文本

## 推荐约定

- `provider_id`：短横线命名（如 `openrouter-main`）
- `capabilities`：仅填实际支持项（`chat/vision/embedding/rerank`）
- 禁止在代码中硬编码真实 API Key
