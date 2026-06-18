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

# 目的

Webサーバーを構成していないターゲットに対してALBのエンドポイントにリクエストして疎通を確認したい。

---

# 構成

```plain
ALB (HTTP:443) -> ターゲットグループ (HTTP:8080) -> EC2インスタンス (HTTP:8080)
```

- [ ] ヘルスチェック設定のスクリーンショットを乗せる

---

# 問題: Webサーバーのミドルウェアがないと疎通確認できない

- ミドルウェアはインフラの責任範囲外なので、インストールは避けたい

---

# 案１: ncコマンド (1/2)

ncコマンドでリクエストを受け取る確認ができる。

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

ただし、ターゲットのヘルスチェックを通すには、ncコマンドでステータス200を返す必要がある。

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

Python の組み込み HTTP サーバーを使用して、ターゲットで HTTP リクエストを受け付けるようにする。

まず、ターゲットで HTTP サーバーを起動して、ローカルでリクエストしてみる。

---

<style>
/* コードブロックのはみ出しを防ぐ */
pre {
  font-size: 0.56em; 
}
</style>

# 案２: PythonでWebサーバーを立てる (2/2)

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

# 補足: PORT変数のスコープ

コマンドの前にパラメータ代入を置くと、PORT はそのコマンドの実行中だけ環境変数として参照できる。

https://astro.uni-bonn.de/~sysstw/CompMan/gnu/bashref.html#TOC49

> 任意の simple command または関数の環境は、パラメータ代入をその前に置くことで一時的に拡張できます。...これらの代入文は、そのコマンドが見る環境にのみ影響します。

実験。

```sh
$ PORT=8080 env | grep PORT
# PORTを環境変数として参照できる
PORT=8080
$ echo ${PORT}
# コマンド実行後のシェル自身にはPORTが残っていない（何も出力されない）
$
```

---

# ローカルホストでリクエストしてみる

```sh
curl http://localhost:8080/my-health-check-path
# OK
```

---

# ALBのエンドポイントにリクエストしてみる

Healthy になったら、ALB のエンドポイントにリクエストしてみる。

```sh
# 疎通確認が目的なので、証明書の検証はスキップする。
curl -k https://alb-endpoint/
# OK
```

確認が終わったら、ターミナルで Ctrl + C して HTTP サーバーを停止する。

---

# 補足: curlの-kオプション

`curl` はデフォルトで TLS 証明書を検証する。今回は疎通確認が目的であるため、必要に応じて`-k` (`--insecure`) オプションで証明書の検証を無効化するとよい。

- ALB のエンドポイント (DNS名) に対して、まだ独自ドメインの証明書 (ACM) を割り当てていない
- 自己署名証明書をテスト用にアタッチしている
- ALB のデフォルトドメイン名と証明書のCNサブジェクトが一致しない

`-k` は証明書の検証を無効化するだけで、通信自体は TLS で暗号化されたまま行われる。

---

# まとめ

- Webサーバーを構成していないターゲットでも、ncコマンドやPythonの組み込みHTTPサーバーで疎通確認ができる
- ncコマンドは手軽だが、ヘルスチェックを通すにはHTTPレスポンスを自分で組み立てる必要がある
- Pythonの組み込みHTTPサーバーなら、ワンライナーでもHTTPサーバーを起動できる
- インフラ担当の責任範囲内（ミドルウェア追加なし）で、ALB -> EC2 の疎通確認が完結できる

---

# ありがとうございました

