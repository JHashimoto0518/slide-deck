---
marp: true
title: ALBの疎通確認をWebサーバーなしでやる
theme: default
header: JAWS-UG東京 ランチタイムLT会 #36
paginate: true
---

# ALBの疎通確認をWebサーバーなしでやる

JAWS-UG東京 ランチタイムLT会 #36

---

# 発表者

- 橋本淳一
- フリーランスのクラウドエンジニア
- 最近都内から栃木に引っ越しました
- AWS歴8年くらい
- 現在の仕事はECサイトのインフラ運用
- ポートフォリオ: https://lapras.com/public/jhashimoto

---

# 前提

- ALB -> EC2
- インフラ担当とアプリ担当が別れている
    - インフラ担当: ALBとEC2の構築
    - アプリ担当: EC2のOSより上のレイヤーを担当
- インフラ担当としてALB -> EC2の疎通確認をして引き渡したい

---

# 通信経路

```
ALB (HTTP:443) -> ターゲットグループ (HTTP:8443) -> ターゲット (HTTP:8443)
```

---

# 目的

Webサーバーを構成していないターゲットに対してALBのエンドポイントにリクエストして疎通を確認したい。

---

# 問題: Webサーバーのミドルウェアがないと疎通確認できない

- ミドルウェアはインフラの責任範囲外なので、インストールは避けたい

---

# 解決策: ncコマンド

- [ ] ncの仕様を調べる
    - リクエストパスに対応できるか？
    - ヘルスチェックに対応できるか？

---

# 解決策: PythonでWebサーバーを立てる

Python の組み込み HTTP サーバーを使用して、ターゲットで HTTP リクエストを受け付けるようにする。リクエストパスに関わらず常に 200 OK を返すので、ヘルスチェックパスを気にせずに疎通確認できる。

まず、ターゲットで HTTP サーバーを起動して、ローカルでリクエストしてみる。

---

```python
PORT=8443 python3 -c "
import http.server, socketserver, os

PORT = int(os.environ['PORT'])

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK\n')
    def log_message(self, format, *args):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Listening on port {PORT}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
"
```

---

# ローカルホストでリクエストしてみる

```sh
curl http://localhost:8443/my-health-check-path
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

---

# ドメインにリクエストしてみる

```sh
curl https://my-domain.com/
# OK
```

確認が終わったら、ターミナルで Ctrl + C して HTTP サーバーを停止する。

---

# まとめ


---

# Appendix: 

CDKのコードとCloudFormationテンプレート。


---

# ありがとうございました



