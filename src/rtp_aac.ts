import { promises } from "fs";
import { initRTPPacket, RTPPair, RTP_VERSION, SendRTPPacket, timeoutPromise } from "./rtp";

const RTP_PAYLOAD_TYPE_AAC = 97;


function parseASDTSHeader(buffer: Buffer): ADTSHeader {
    if (buffer.length !== 7) {
        throw new Error(`header is not 7 bytes, got:${buffer.length}`);
    }
    const [byte0, byte1, byte2, byte3, byte4, byte5, byte6] = buffer;
    if (byte0 !== 0xFF || (byte1 & 0xF0) !== 0xF0)
        throw new Error("malfromed adts header");

    return {
        syncWord: 0xFFF,
        id: (byte1 & 0x08) >> 3,
        layer: (byte1 & 0x06) >> 1,
        protectionABsent: byte1 & 0x01,
        profile: (byte2 & 0xc0) >> 6,
        sampleFreqIndex: (byte2 & 0x3c) >> 2,
        privateBit: (byte2 & 0x02) >> 2,
        channelConfig: (byte2 & 0x01) << 2 | (byte3 & 0xc0) >> 6,
        originalCopy: (byte3 & 0x20) >> 5,
        home: (byte3 & 0x10) >> 4,
        copyrightIdentificationBit: (byte3 & 0x08) >> 3,
        copyrightIdentificationStart: (byte3 & 0x04) >> 2,
        aacFrameLength: (byte3 & 0x03) << 11 | (byte4 & 0xFF) << 3 | (byte5 & 0xE0) >> 5,
        adtsBufferFullness: (byte5 & 0x1F) << 6 | (byte6 & 0xFC) >> 2,
        numberOfRawDataBlockInFrame: byte6 & 0x03,
    } as ADTSHeader;
}

export interface ADTSHeader {
    syncWord: number;//12 bit
    id: number;//1 bit
    layer: number;//2 bit
    protectionABsent: number;//1 bit
    profile: number;//2 bit
    sampleFreqIndex: number;//4 bit
    privateBit: number;//1 bit
    channelConfig: number;//3 bit
    originalCopy: number;//1 bit
    home: number;//1 bit

    copyrightIdentificationBit: number;//1 bit
    copyrightIdentificationStart: number;//1 bit
    aacFrameLength: number;//13 bit
    adtsBufferFullness: number;//11 bit
    numberOfRawDataBlockInFrame: number;//2 bit

};

export class RTP_AAC extends RTPPair {
    async startSend() {
        const fh = await promises.open(this.file, 'r');
        let packet = initRTPPacket(0, 0, 0, RTP_VERSION, RTP_PAYLOAD_TYPE_AAC, 1, 0, 0, 0x32411);
        while (true) {
            if (this.finished)
                break;
            const headerBuffer = Buffer.alloc(7);
            let { bytesRead } = await fh.read(headerBuffer, 0, 7);
            if (bytesRead !== 7)
                break;
            const header = parseASDTSHeader(headerBuffer);
            const AACDataLength = header.aacFrameLength - 7;
            const AACData = Buffer.alloc(AACDataLength);
            ({ bytesRead } = await fh.read(AACData, 0, AACDataLength));
            if (bytesRead !== AACDataLength)
                throw new Error("can't read enough data");
            //0xffe0 = 1 1111 1110 0000 0x1f = 11111
            const fistFour = Buffer.from([0x00, 0x10, (0xffe0 & AACDataLength) >> 5, (0x1f & AACDataLength) << 3]);
            packet.payload = Buffer.concat([fistFour, AACData]);
            await SendRTPPacket(packet, this.rtp, this.clientRTPPort, this.clientHost);
            packet.header.seq++;
            packet.header.timestamp += 1025;
            await timeoutPromise(23);
        }
    }
};

function main() {
    let pair = new RTP_AAC('./test.aac', '192.168.1.72', 9832, 9833, 0);
    pair.startSend();
}

main();
