import { createServer, Socket } from "net";
import { AddressInfo } from "node:net";
import { getReq, Session } from "./rtsp";

const splitter = '\r\n\r\n';
const line_splitter = '\r\n';


function getLine(req: string): [string, string] {
    let pos = req.indexOf(line_splitter);
    if (pos === -1) {
        return [req, ''];
    }
    return [req.substring(0, pos + line_splitter.length), req.substr(pos + line_splitter.length)];
}

function getMethod(params: string): string | null {
    const result = /(.*) .* .*/.exec(params);
    if (!result) {
        return null;
    }
    return result[1];
}

function getCSeq(params: string): string | null {
    const result = /CSeq\: (\d+)/.exec(params);
    if (!result) {
        return null;
    }
    return result[1];
}

function getPort(content: string): [number, number] {
    const result = /(\d+)-(\d+)/.exec(content);
    if (!result || result.length < 3) {
        throw new Error("can not parse rtp");

    }
    return [parseInt(result[1]), parseInt(result[2])];
}

export class RTSPServer {
    constructor(port: number,) {
        this.sessionMap = new Map<string, Session>();
    }
    sessionMap: Map<string, Session>;
    connection(socket: Socket) {
        let data = '';
        let session: Session = {
            clientHost: (socket.address() as AddressInfo).address,
        };
        socket.on('data', (buffer) => {
            data += buffer;
            let end = data.indexOf(splitter);
            if (end != -1) {
                const cb = (response: string) => {
                    console.log(`response:${response}`);
                    socket.write(response);
                };
                getReq(session, data.substring(0, end + splitter.length), cb);
                data = data.substr(end + splitter.length);
            }
        });
    }
    const server = createServer();
    server.listen(8554, '0.0.0.0', () => console.log('server llisten on 8554'));
};