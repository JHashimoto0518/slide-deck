---
marp: true
title: SteampipeとExcel Power QueryでAWS構成定義書の作成を自動化する
theme: default
header: JAWS-UG東京 ランチタイムLT会 #36
paginate: true
style: |
  /* 総ページ数を出す */
  section::after {
    content: attr(data-marpit-pagination) " / " attr(data-marpit-pagination-total);
  }
---

# SteampipeとExcel Power Queryで<br>AWS構成定義書の作成を自動化する

JAWS-UG東京 ランチタイムLT会 #36

---

# 発表者

- 橋本淳一
- フリーランスのクラウドエンジニア
- 最近都内から栃木に引っ越しました
- 現在の仕事はECサイトのインフラ運用
- ポートフォリオ: https://lapras.com/public/jhashimoto

---

# 問題: 構成定義書のメンテナンスが辛い

- 手動で作成した構成定義書は継続的なメンテナンスが必要
- 構成変更のたびに手作業で更新しなければならない
- 更新漏れや情報の不整合が発生しやすい
- 気づけば定義書が陳腐化している

---

# 解決策: SteampipeとPower Queryで自動化する

- Steampipe でAWSリソースの構成情報をSQLで取得してCSVに出力
- Excel Power Query でCSVを読み込んで構成定義書を生成
- CSVを再出力して「更新」するだけで最新のシステム構成を定義書に同期

---

# この手法のメリット

- AWS環境の実態を唯一の情報源とみなす
  - ドキュメントは「読み取り専用のビュー」なので手動メンテ不要
- 構築手法に依存しない
  - マネコン・CLI・CloudFormation・Terraform … 何でも対応
- システムのライフサイクルに依存しない
  - 定義書が存在しない・陳腐化した環境でも即座に実態把握が可能
- クラウドサービスに依存しない
  - Steampipeプラグインで AWS / Azure / GCP / などに対応

---

# Steampipe とは

https://steampipe.io/

- SQLでクラウドリソースの情報を抽出できるオープンソースツール
- プラグイン方式で各クラウドプロバイダーに対応
- 今回はAWSプラグインを使用

---

# Steampipeの実行環境

- SteampipeはAWS CLIと同じ仕組み (AWS環境変数やデフォルトプロファイルなど) で認証情報を解決する
  - https://hub.steampipe.io/plugins/turbot/aws
- 今回は開発コンテナを使用し、aws loginで認証情報を取得する
---

# Steampipeのインストール

https://steampipe.io/downloads?install=linux

```bash
sudo /bin/sh -c "$(curl -fsSL https://steampipe.io/install/steampipe.sh)"

# AWSプラグインのインストール
steampipe plugin install aws
```

---

# 構成情報をCSVで抽出する (1/2)

<style>
/* コードブロックのはみ出しを防ぐ */
pre {
  font-size: 0.54em; 
}
</style>

[テーブルのリファレンス](https://hub.steampipe.io/plugins/turbot/aws/tables)を元にSQLを記述する。

```sql
cat << EOF > ./ec2-sg-rule.sql
select
  i.instance_id as "インスタンスID",
  i.tags ->> 'Name' as "インスタンス名",
  sg ->> 'GroupId' as "セキュリティグループID",
  sg ->> 'GroupName' as "セキュリティグループ名",
  sgr.type as "IN/OUT",
  case when sgr.ip_protocol::text = '-1' then 'すべて' else sgr.ip_protocol::text end as "プロトコル",
  case when sgr.from_port::text = '-1' then 'すべて' else sgr.from_port::text end as "許可ポート",
  sgr.cidr_ipv4 as "ソース",
  sgr.description as "説明"
from
  aws_ec2_instance as i
  -- インスタンスが持つセキュリティグループのJSON配列を複数行に展開
  cross join jsonb_array_elements(i.security_groups) as sg
  -- セキュリティグループIDをキーにルールと結合
  inner join aws_vpc_security_group_rule as sgr
    on sg ->> 'GroupId' = sgr.group_id
order by
  i.instance_id,
  sgr.type,
  sgr.from_port;
EOF
```

---

# 構成情報をCSVで抽出する (2/2)

クエリを実行してCSVに出力する。

```bash
steampipe query --output csv ec2-sg-rule.sql > ec2-sg-rule.csv
```

出力例:

```
インスタンスID,インスタンス名,セキュリティグループID,セキュリティグループ名,IN/OUT,プロトコル,許可ポート,ソース,説明
i-0e81f7e63504abda6,ec2-bastion,sg-050572b43599e8ef2,ec2-stack-Ec2BastionSg1EDD4366-X5T1r7Hd7tyT,egress,すべて,すべて,0.0.0.0/0,Allow all outbound traffic by default
i-0e81f7e63504abda6,ec2-bastion,sg-050572b43599e8ef2,ec2-stack-Ec2BastionSg1EDD4366-X5T1r7Hd7tyT,ingress,tcp,22,203.0.113.0/24,allow ssh traffic from example IP address
i-0f586042c6e12ace3,ec2-web,sg-0d4e271ce4639e2d3,ec2-stack-Ec2WebSg16F497FB-5tiwp6QDbLNd,egress,すべて,すべて,0.0.0.0/0,Allow all outbound traffic by default
i-0f586042c6e12ace3,ec2-web,sg-0d4e271ce4639e2d3,ec2-stack-Ec2WebSg16F497FB-5tiwp6QDbLNd,ingress,tcp,80,0.0.0.0/0,allow http traffic from anywhere
i-0f586042c6e12ace3,ec2-web,sg-0d4e271ce4639e2d3,ec2-stack-Ec2WebSg16F497FB-5tiwp6QDbLNd,ingress,tcp,443,0.0.0.0/0,allow https traffic from anywhere
```

---

# Power Query とは

- Excelに組み込まれたデータ取得・変換ツール
- さまざまなデータソースから情報を取り込み、整形できる
- CSVファイルのデータをExcelシートに読み込むために利用する

---

# CSVをExcelシートに読み込む

1. Excelの [データ] タブを開く
2. [データの取得]→[テキストまたはCSVから] でCSVを選択
3. [データの変換] をクリック
4. Power Queryエディターで [1行目をヘッダーとして使用] をクリック
5. [閉じて読み込む] でシートにインポート

CSVデータをもとにExcelテーブル（構成定義書）が完成する。

---

# 構成変更を定義書に反映する

システムに変更があったら

1. ローカルの古いCSVファイルを上書き
1. Excelのテーブルを右クリック→ [更新]

定義書が最新の構成情報に自動的に同期される。

---

# {ページタイトルを書く}

- SQL JOINで関連リソースを結合したCSVを出力できる
- さまざまな「関心事」に焦点を当てた構成定義書を生成  

---

# デモ

EC2インスタンスとセキュリティグループをJOIN → 「サーバーへの通信許可」の一覧

---

# デメリット

- テーブルのリファレンスを見ながらSQLを書くのが面倒
  - クエリ例は公式ドキュメントに多数掲載されているので参考にすると良い
    - https://hub.steampipe.io/plugins/turbot/aws/queries
  - Steampipe公式のMCPサーバーがある
    - https://steampipe.io/blog/steampipe-mcp
- Power Queryはサーバー上では利用できないため、CIには組み込みにくい
  - Powershellによるデスクトップでの自動化は可
    - https://www.cloudbuilders.jp/articles/4242/

---

# まとめ

- Steampipe でAWSリソースをSQLで取得してCSVに抽出
- Excel Power Query でCSVを読み込んで構成定義書を生成
- CSVを上書き→ Excelで「更新」するだけで常に最新状態を維持
- 構築手法・ライフサイクル・クラウドサービスに依存しない汎用的な手法

手動メンテナンスの負荷を大幅に削減し、信頼性の高い構成定義書を実現できる。

---

# ありがとうございました

元記事: https://zenn.dev/jhashimoto/articles/steampipe-powerquery-aws-configdoc
