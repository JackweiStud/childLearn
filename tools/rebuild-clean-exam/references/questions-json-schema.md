# questions.json 中间模型

`questions.json` 是试卷重建的事实层。它保存源图事实、逐题转写、来源标记和待确认项；PDF 生成脚本只消费已确认或明确标注推断的内容。

## 顶层字段

- `schema`: 固定为 `rebuild-clean-exam.questions.v1`。
- `title`: 卷名或工作名。
- `created_at`: UTC ISO 时间。
- `pages`: 按页序排列的页面数组。
- `ambiguities`: 全卷待确认项数组。

## 页面字段

- `page_number`: 从 1 开始的连续页码。
- `source_image`: 源图事实，包含 `path`、`filename`、`format`、`width_px`、`height_px`、`long_edge_px`、`file_size_bytes`、`sha256`。
- `rotation_degrees`: 校正后旋转角度；未校正时为 `0`。
- `status`: `needs_transcription`、`in_review`、`confirmed` 或 `blocked`。
- `source_notes`: 页面级备注，例如“左上角阴影但题干可辨认”。
- `questions`: 页面内题目数组。

## 题目字段建议

每道题至少包含：

```json
{
  "id": "1",
  "type": "choice",
  "text": "题干文字",
  "options": [{"label": "①", "text": "17"}],
  "answer_space": {"kind": "lines", "count": 3},
  "figures": [],
  "source": "image_clear",
  "confidence": "high",
  "notes": []
}
```

`source` 只使用以下值：

- `image_clear`: 原图清晰可见。
- `user_confirmed`: 用户补充确认。
- `original_exam_verified`: 用户明确要求反查且版本逐题核验一致。
- `context_inferred`: 根据同页上下文推断，必须在 `notes` 解释。
- `needs_user_confirmation`: 被遮挡或证据不足，不能用于最终准确性声明。

`confidence` 使用 `high`、`medium`、`low`、`pending`。只要存在 `pending` 或 `needs_user_confirmation`，交付说明必须列出待确认项。
