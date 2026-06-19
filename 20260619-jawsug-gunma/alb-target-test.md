---
marp: true
title: ALBの疎通確認をWebサーバーなしでやる
theme: default
header: JAWS-UG 群馬 #35
paginate: true
style: |
  /* 総ページ数を出す */
  section::after {
    content: attr(data-marpit-pagination) " / " attr(data-marpit-pagination-total);
  }
---

# ALBの疎通確認をWebサーバーなしでやる

JAWS-UG 群馬 #35 10分LT

---

# 発表者

- 橋本淳一
- フリーランスのクラウドエンジニア
- 最近都内から栃木に引っ越しました
- 現在の仕事はECサイトのインフラ運用
- ポートフォリオ: https://lapras.com/public/jhashimoto

---

# 前提

- インフラ担当とアプリ担当が別れている
    - インフラ担当: ALBとEC2の構築
    - アプリ担当: EC2のOSより上のレイヤーを担当
- インフラ担当としてALB -> EC2の疎通確認をして引き渡したい

---

# 構成

以下の経路を想定。

```plain
クライアント
  │ HTTPS:443
  ▼
ALB + ACM
  │ HTTP:8080
  ▼
ターゲットグループ
  │ HTTP:8080
  ▼
EC2インスタンス
```

---

# 目的

- ALBにリクエストし、ターゲットからのレスポンスが返ることを確認したい
- ただし、Apache/Nginx等のミドルウェアはインストールしたくない（インフラの責務ではないから）

テスト例:

```sh
curl https://my-domain.com/
# OK
```

---

# 問題

- Webサーバーのミドルウェアがないとレスポンスが返せない
- ターゲットグループのヘルスチェックをパスする必要がある
  - 例: ステータス200を3回連続で返したら、Healthy

![](./images/tggrp-healthcheck.png)

---

# 案１: ncコマンド (1/2)

ncコマンドのシンプルな使い方。

```sh
# サーバーで待ち受けておく
nc -lk 8080
```

```sh
# クライアントからリクエスト
echo "OK" | nc -q 0 {サーバーIP} 8080
```

- `-l`: Listen モード
- `-k`: Keep inbound sockets open for multiple connects. 切断後も同じポートで次の接続を待ち続ける
- `-q 0`: quit after EOF on stdin and delay of secs. STDIN で EOF 後すぐに閉じる

---

# 案１: ncコマンド (2/2)

以下をターゲットで実行しておくと、ヘルスチェックをパスでき、リクエストに対してレスポンスを返せる。

- 8080でリッスンし、リクエストに対して200を返す
- レスポンスを返した後も、リッスンが継続される

```sh
while true; do
  echo -e "HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nOK\n" | nc -l 8080
done
# 以下のレスポンスを返す
# HTTP/1.1 200 OK
# Content-Length: 3
# 
# OK
#
```

---

# 案２: PythonでWebサーバーを立てる (1/2)

Pythonの組み込みHTTPサーバーなら、ワンライナーでHTTPサーバーを起動できる。

---

# 案２: PythonでWebサーバーを立てる (2/2)

<style>
/* コードブロックのはみ出しを防ぐ */
pre {
  font-size: 0.56em; 
}
</style>

```python
PORT=8080 python3 -c "
import http.server, socketserver, os

PORT = int(os.environ['PORT'])

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK\n')
    def log_message(self, format, *args):
        pass

# TCPサーバの終了直後にもう一度起動したときの「Address already in use」エラーを避ける
# https://www.geekpage.jp/programming/winsock/so_reuseaddr.php
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Listening on port {PORT}')
    try:
        httpd.serve_forever()
    # Ctrl + C による KeyboardInterruptを抑制
    except KeyboardInterrupt:
        pass
"
```

---

# 補足: コマンド実行後にPORT変数は参照されるか？

A: 参照されないので、環境を汚さない

コマンドの前に KEY=VALUE の形式で書くことを「パラメータ代入」と呼び（シェルの機能）、そのコマンドの実行中だけ環境変数として参照できる。

実験結果:

```sh
$ PORT=8080 env | grep PORT
# PORTを環境変数として参照できる
PORT=8080
$ echo ${PORT}
# コマンド実行後のシェル自身にはPORTが残っていない（何も出力されない）
$
```

参考: https://astro.uni-bonn.de/~sysstw/CompMan/gnu/bashref.html#TOC49

---

# リクエストしてみる

ローカルホストにリクエストする。

```sh
curl http://localhost:8080/my-health-check-path
# OK
```

ターゲットのステータスが Healthy になったらドメインに対してリクエストする。

```sh
curl https://my-domain.com/
# OK
```

確認が終わったら、ターミナルで Ctrl + C して HTTP サーバーを停止する。

---

# まとめ

- Webサーバーを構成していないターゲットでも、ncコマンドやPythonの組み込みHTTPサーバーで疎通確認ができる
- ncコマンドは手軽だが、ヘルスチェックを通すにはHTTPレスポンスを自分で組み立てる必要がある
- Pythonの組み込みHTTPサーバーなら、ワンライナーでもHTTPサーバーを起動できる
- インフラ担当の責任範囲内（ミドルウェア追加なし）で、ALB -> EC2 の疎通確認が完結できる

---

# ありがとうございました

