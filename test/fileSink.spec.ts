/// <reference path="../node_modules/@types/node/index.d.ts" />
/// <reference path="../node_modules/@types/jest/index.d.ts" />
/// <reference path="../node_modules/typemoq/dist/typemoq.d.ts" />

import * as TypeMoq from 'typemoq';
import { Stats } from 'fs';
import * as fsp from 'fs/promises';

import { LogEvent, LogEventLevel } from '../src/logEvent';
import { MessageTemplate } from '../src/messageTemplate';
import { FileSink } from '../src/fileSink';

describe('FileSink', () => {
    const fileSystemMock = TypeMoq.Mock.ofType<typeof fsp>();

    describe('emit()', () => {
        it('creates a file if it does not exist', async () => {
            fileSystemMock.setup(fs => fs.access(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber())).throws(new Error('file does not exist'));
            fileSystemMock.setup(fs => fs.writeFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.stat(TypeMoq.It.isAnyString())).returns(() => Promise.resolve({ size: 0 } as Stats));
            fileSystemMock.setup(fs => fs.appendFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
            const sink = new FileSink({}, fileSystemMock.object);

            await sink.emit([new LogEvent('', LogEventLevel.information, new MessageTemplate('test'))]);

            fileSystemMock.verifyAll();
        });

        it('rolls the file if it exceeds the max file size', () => {
            fileSystemMock.setup(fs => fs.access(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.stat(TypeMoq.It.isAnyString())).returns(() => Promise.resolve({ size: 1024 } as Stats));
            fileSystemMock.setup(fs => fs.readdir(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(['maxSizeFile.log']));
            fileSystemMock.setup(fs => fs.rename(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.access(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber())).throws(new Error('file does not exist'));
            fileSystemMock.setup(fs => fs.writeFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.appendFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
            const sink = new FileSink({ maxFileSize: 1024 }, fileSystemMock.object);

            sink.emit([new LogEvent('', LogEventLevel.information, new MessageTemplate('test'))]);

            fileSystemMock.verifyAll();
        });

        it('appends to existing file', () => {
            fileSystemMock.setup(fs => fs.access(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.stat(TypeMoq.It.isAnyString())).returns(() => Promise.resolve({ size: 1024 } as Stats));
            fileSystemMock.setup(fs => fs.appendFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
            const sink = new FileSink({ maxFileSize: 2 * 1024 }, fileSystemMock.object);

            sink.emit([new LogEvent('', LogEventLevel.information, new MessageTemplate('test'))]);

            fileSystemMock.verifyAll();
        });

        it('does not log events lower than the restricted level', () => {
            fileSystemMock.setup(fs => fs.access(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber())).returns(() => Promise.resolve());
            fileSystemMock.setup(fs => fs.stat(TypeMoq.It.isAnyString())).returns(() => Promise.resolve({ size: 1024 } as Stats));
            fileSystemMock.setup(fs => fs.appendFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
            const sink = new FileSink({ logEventLevel: LogEventLevel.warning }, fileSystemMock.object);

            sink.emit([new LogEvent('', LogEventLevel.information, new MessageTemplate('test'))]);

            fileSystemMock.verifyAll();
        });
    });
});
