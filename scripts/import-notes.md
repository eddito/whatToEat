# Data Import Notes

Source workbook: `今天吃什么.xlsx`

## Sheets

- `红榜`: 74 rows
- `再练练`: 3 rows
- `智能表1`: empty template, not imported in MVP

## Field Mapping

| Excel | Target |
| --- | --- |
| 店名 | `places.name` |
| 类型 | `places.category` |
| 口味 | `places.taste_tags` |
| 特色菜 | `places.signature_dishes` |
| 评价 | `places.review_summary` |
| 地区 | `places.region` |
| 具体位置 | `places.location_label` |
| 停车 | `places.parking_note` |
| 来源 | `places.source_label` |
| 已探店 | `places.visited` |
| 打分（杨） | `ratings.score` for imported member Yang |
| 打分（陈） | `ratings.score` for imported member Chen |
| 打分（综合） | legacy validation only |

## Current Seed File

`src/data/seed-places.json` contains 77 records generated from the workbook.
