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

- **Steampipe** でAWSリソースの構成情報をSQLで取得してCSVに出力
- **Excel Power Query** でCSVを読み込んで構成定義書を生成
- CSVを再出力して「更新」するだけで最新のシステム構成を定義書に同期

---

# 本手法のメリット

- **Single Source of Truth の実現**
  - AWS環境の実態を唯一の情報源とみなす
  - ドキュメントは「読み取り専用のビュー」なので手動メンテ不要

- **構築手法に依存しない**
  - マネコン・CLI・CloudFormation・Terraform … 何でも対応

- **システムのライフサイクルに依存しない**
  - 定義書が存在しない・陳腐化した環境でも即座に実態把握が可能

- **クラウドサービスに依存しない**
  - Steampipeプラグインで AWS / Azure / GCP / Kubernetes などに対応

---

# Steampipe とは

https://steampipe.io/

- SQLでクラウドリソースの情報を抽出できるオープンソースツール
- プラグイン方式で各クラウドプロバイダーに対応
- 今回はAWSプラグインを使用

---

# Steampipeの実行環境

- Steampipeの実行しCSVを出力する
- 今回はCloudShellを使用するが、AWS APIにアクセスできるターミナルなら何でもよい
- マネジメントコンソールから直接アクセスできるブラウザベースのシェル
- コンソールの認証情報をそのまま引き継ぐため **IAMユーザーさえあれば追加設定不要**

---

# Steampipeのインストール

```bash
curl -s -L https://github.com/turbot/steampipe/releases/latest/download/steampipe_linux_amd64.tar.gz | tar -xzvf 

# AWSプラグインのインストール
./steampipe plugin install aws
```

参考: https://steampipe.io/docs/integrations/aws_cloudshell

---

# 構成情報をCSVで抽出する (1/2)

<style>
/* コードブロックのはみ出しを防ぐ */
pre {
  font-size: 0.54em; 
}
</style>

[リファレンス](https://hub.steampipe.io/plugins/turbot/aws/tables/aws_ec2_instance)を元にSQLを記述する。

```sql
cat << EOF > ./ec2-ins.sql
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
EOF
```

---

# 構成情報をCSVで抽出する (2/2)

クエリを実行してCSVに出力する。

```bash
./steampipe query --output csv ./ec2-ins.sql > ./ec2-ins.csv
```

出力例:

```
名前,インスタンスID,インスタンスタイプ,...
ec2Bastion,i-02059f9af149877ba,t2.micro,...
ec2Web,i-0b9aee37d0d95137b,t2.micro,...
```

CloudShellの [アクション]→[ファイルのダウンロード] でCSVをローカルに保存

---

# Power Query とは

- Excelに組み込まれたデータ取得・変換ツール
- さまざまなデータソースから情報を取り込み、整形できる
- CSVファイルのデータをExcelシートに読み込むために利用する

---

# CSVをExcelシートに読み込む

1. Excelの **[データ]** タブを開く
2. **[データの取得]→[テキストまたはCSVから]** でCSVを選択
3. **[データの変換]** をクリック
4. Power Queryエディターで **[1行目をヘッダーとして使用]** をクリック
5. **[閉じて読み込む]** でシートにインポート

→ CSVデータをもとにExcelテーブル（構成定義書）が完成

---

# 構成変更を定義書に反映する

システムに変更があったら:

1. CloudShellでSteampipeを再実行して最新のCSVを取得
2. ローカルの古いCSVファイルを上書き
3. Excelのテーブルを右クリック→ **[更新]**

→ 定義書が最新の構成情報に自動的に同期される

---

# デメリット

- CIに組み込めない
  - デスクトップでの自動化は可

---

# まとめ

- **Steampipe** でAWSリソースをSQLで取得してCSVに抽出
- **Excel Power Query** でCSVを読み込んで構成定義書を生成
- CSVを上書き→ Excelで「更新」するだけで常に最新状態を維持
- 構築手法・ライフサイクル・クラウドサービスに依存しない汎用的な手法

**手動メンテナンスの負荷を大幅に削減し、信頼性の高い構成定義書を実現できる**

---

# 次のステップ

- SQL JOINで関連リソースを結合した定義書の生成
  - 例: EC2インスタンス + セキュリティグループ → 「サーバーへの通信許可」一覧
  - さまざまな「関心事」に焦点を当てた構成定義書の生成へ
- Steampipe公式のMCPサーバーがある
  https://steampipe.io/blog/steampipe-mcp

---

# ありがとうございました

元記事: https://zenn.dev/jhashimoto/articles/steampipe-powerquery-aws-configdoc
