// const buf = Buffer.alloc(4);

// StreamBuffer

// buf.writeUInt16BE(0xdead);
// buf.writeUInt16BE(0xbeef);
// // buf.writeUInt16BE(0xbeef);
// console.log(buf);
// console.log(buf.readUInt16BE());
// console.log(buf);
// // Prints: <Buffer de ad be ef>


// const buf = Buffer.from('this is a buffer');
// let sl = buf.slice(0,5);
// console.log(sl,sl.length,buf.length);

const { createSocket } = require('dgram');

const rtp = createSocket('udp4');
rtp.bind(12345);

let content = Buffer.alloc(10);
content.write('123123');
content.s
console.log(content.byteLength);

// rtp.connect(8554, 'localhost');
rtp.send(content, 8554, 'localhost', (err, bytes) => {
    console.log(err, bytes);
});

