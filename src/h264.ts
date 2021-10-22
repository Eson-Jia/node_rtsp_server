import { promises, createReadStream } from "fs";


const MAX_RTP_PAYLOAD = 1400;

const startCode3 = new Uint8Array([0x00, 0x00, 0x01]);

const startCode4 = new Uint8Array([0x00, 0x00, 0x00, 0x01]);

function main1() {
    let stream = createReadStream('./test.h264');
    stream.on('readable', () => {
        const buffer: Buffer = stream.read(1400);
        let bufferList = new Array();
        console.log(buffer.indexOf(new Uint8Array([0x00, 0x00, 0x00, 0x01])));
    });
}

// main1();

async function main() {
    const fullFile = await promises.readFile('./test.h264');
    let nextBegin = 0;
    let frameList = new Array<Buffer>();
    while (true) {
        let index4 = fullFile.indexOf(startCode4, nextBegin);
        let index3 = fullFile.indexOf(startCode3, nextBegin);
        if ((index4 === -1) && (index3 === -1)) {
            console.log('last frame');
            break;
        } else if (index4 === -1) {
            // 开始码为 0 0 1
            if (nextBegin !== 0)
                frameList.push(fullFile.slice(nextBegin, index3));
            nextBegin = index3 + 3;
        } else {
            // 开始码为 0 0 0 1
            if (nextBegin !== 0)
                frameList.push(fullFile.slice(nextBegin, index4));
            nextBegin = index4 + 4;
        }
    }

    for (const frame of frameList) {
        if (frame.length > MAX_RTP_PAYLOAD) {//分包
            let frags = Math.ceil(frame.length / MAX_RTP_PAYLOAD);
            for (let index = 0; index < frags; index++) {
                if (index === 0) {
                    // FU begin
                } else if (index === frags - 1) {
                    // FU end
                } else {
                    // FU 中间
                }
                //填充数据
            }
        } else {
            //填充数据
        }
        let payload = Buffer.from('this is payload');
        const packet = RTPPakcet{
            header: {

            },
            payload:
        };
    }
};

main();

function RTPPakcet() {
    throw new Error("Function not implemented.");
}
