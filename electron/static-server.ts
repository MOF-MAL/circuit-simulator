import http from "node:http";
import sirv from "sirv";

// 固定ポートで待受ける: 起動ごとにオリジンが変わると、
// オリジン単位でスコープされる localStorage の自動保存内容が
// 再起動のたびに失われたように見えるため。
const PORT = 47823;

export function startStaticServer(dir: string): Promise<string> {
  const serve = sirv(dir, { single: true });

  return new Promise((resolve, reject) => {
    const server = http.createServer(serve);
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${PORT}`);
    });
  });
}
