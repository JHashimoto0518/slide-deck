---
marp: true
title: SteampipeとExcel Power QueryでAWS構成定義書の作成を自動化する
theme: default
header: JAWS-UG東京 ランチタイムLT会 #36
paginate: true
style: |
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
- 気づけば定義書が現実と乖離している

実際のAWS環境と定義書のどちらを信じればいいか、わからなくなる

---

# 解決策: SteampipeとPower Queryで自動化する

- SteampipeでAWSリソースの構成情報をSQLで取得してCSVに出力
- Excel Power QueryでCSVを読み込んで構成定義書を生成
- CSVを再出力して「更新」するだけで最新の構成を定義書に同期

---

# この手法のメリット

- AWS環境の実態を唯一の情報源とみなす
  - ドキュメントは「読み取り専用のビュー」なので手動メンテ不要
- 構築手法に依存しない
  - マネコン・CLI・CloudFormation・Terraform、何でも対応
- システムのライフサイクルに依存しない
  - 定義書が存在しない・陳腐化した環境でも即座に実態を把握できる
- クラウドサービスに依存しない
  - SteampipeプラグインでAWS / Azure / GCPなどに対応

---

# Steampipe とは

https://steampipe.io/

- SQLでクラウドリソースの情報を抽出できるオープンソースツール
- プラグイン方式で各クラウドプロバイダーに対応
- 認証はAWS CLIと同じ仕組みで動作する（環境変数・プロファイルなど）
  - https://hub.steampipe.io/plugins/turbot/aws

今回は開発コンテナを使用し、`aws sso login` で認証情報を取得する

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

[テーブルのリファレンス](https://hub.steampipe.io/plugins/turbot/aws/tables) を参照しながらSQLを記述する。

<style>
/* コードブロックのはみ出しを防ぐ */
pre {
  font-size: 0.54em; 
}
</style>

```sql
SELECT
  tags->>'Name' AS "名前",
  instance_id AS "インスタンスID",
  instance_type AS "インスタンスタイプ",
  image_id AS "イメージID",
  private_dns_name AS "プライベートDNS",
  private_ip_address AS "プライベートIP",
  public_dns_name AS "パブリックDNS",
  public_ip_address AS "パブリックIP",
  vpc_id AS "VPC ID",
  subnet_id AS "サブネットID",
  placement_availability_zone AS "アベイラビリティゾーン",
  root_device_name AS "ルートデバイス名",
  key_name AS "キーペア",
  platform_details AS "プラットフォーム",
  architecture AS "アーキテクチャ"
FROM aws_ec2_instance
-- 終了したインスタンスは除外
WHERE NOT instance_state = 'terminated'
ORDER BY "名前";
```

---

# 構成情報をCSVで抽出する (2/2)

クエリを実行してCSVに出力する。

```bash
steampipe query --output csv ec2.sql > ec2.csv
```

出力例:

```
名前,インスタンスID,インスタンスタイプ,イメージID,プライベートDNS,プライベートIP,パブリックDNS,パブリックIP,VPC ID,サブネットID,アベイラビリティゾーン,ルートデバイス名,キーペア,プラットフォーム,アーキテクチャ
ec2-bastion,i-0e81f7e63504abda6,t2.micro,ami-0d71b1617df761282,ip-172-16-0-148.ap-northeast-1.compute.internal,172.16.0.148,,,vpc-0b62c113836129ebd,subnet-071b09fbb23cea409,ap-northeast-1a,/dev/xvda,,Linux/UNIX,x86_64
ec2-web,i-0f586042c6e12ace3,t2.micro,ami-0d71b1617df761282,ip-172-16-2-215.ap-northeast-1.compute.internal,172.16.2.215,,,vpc-0b62c113836129ebd,subnet-0c14a31632dc31f61,ap-northeast-1a,/dev/xvda,,Linux/UNIX,x86_64
```

---

# Power Query とは

- Excelに組み込まれたデータ取得・変換ツール
- さまざまなデータソースから情報を取り込み、整形できる
- CSVファイルのデータをExcelシートに読み込むために利用する

---

# CSVをExcelシートに読み込む

初回のみ以下の手順でセットアップする。

1. Excelの [データ] タブを開く
2. [データの取得] → [テキストまたはCSVから] でCSVを選択
3. [データの変換] をクリック
4. Power Queryエディターで [1行目をヘッダーとして使用] をクリック
5. [閉じて読み込む] でシートにインポート

CSVの内容をもとにExcelテーブル（構成定義書）が完成する。

---

# 構成変更を定義書に反映する

システムに変更があったら

1. ローカルの古いCSVファイルを上書き
2. Excelのテーブルを右クリック → [更新]

定義書が最新の構成情報に自動的に同期される。
一度セットアップすれば、以降はコマンド1本とExcelの操作だけで済む。

---

# さまざまな定義書を生成できる

SQLのJOINを変えるだけで、関心事に応じた定義書を複数作成できる。

| 定義書の種類 | 使うテーブル（例） |
|---|---|
| サーバー通信許可一覧 | `aws_ec2_instance` × `aws_vpc_security_group` ×  `aws_vpc_security_group_rule` |
| RDSインスタンス一覧 | `aws_rds_db_instance` |
| S3バケットポリシー一覧 | `aws_s3_bucket` |
| IAMロール・ポリシー一覧 | `aws_iam_role` × `aws_iam_policy` |

---

# デモ

EC2インスタンスとセキュリティグループをJOIN → 「サーバーへの通信許可」の一覧

---

# デメリット

- テーブルのリファレンスを見ながらSQLを書くのが面倒
  - クエリ例は公式ドキュメントに多数掲載されているので参考にすると良い
    - https://hub.steampipe.io/plugins/turbot/aws/queries
  - Steampipe公式のMCPサーバーがあり、AIにSQL生成を任せることもできる
    - https://steampipe.io/blog/steampipe-mcp
- Power Queryはサーバー上では利用できないため、CIには組み込みにくい
  - PowerShellによるデスクトップでの自動化は可能
    - https://www.cloudbuilders.jp/articles/4242/

---

# まとめ

- SteampipeでAWSリソースをSQLで取得してCSVに抽出
- Excel Power QueryでCSVを読み込んで構成定義書を生成
- CSVを上書き → Excelで「更新」するだけで常に最新状態を維持
- 構築手法・ライフサイクル・クラウドサービスに依存しない汎用的な手法

手動メンテナンスの負荷を大幅に削減し、信頼性の高い構成定義書を実現できる。

---

# ありがとうございました

元記事: https://zenn.dev/jhashimoto/articles/steampipe-powerquery-aws-configdoc
