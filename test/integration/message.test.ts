/*
 * Copyright (C) 2018 The ontology Authors
 * This file is part of The ontology library.
 *
 * The ontology is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The ontology is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with The ontology.  If not, see <http://www.gnu.org/licenses/>.
 */

import { extractKeyId, extractOntId, Message, retrievePublicKey } from '../../src/claim/message';
import { TEST_ONT_URL_2 } from '../../src/consts';
import { PrivateKey } from '../../src/crypto';
import { Identity } from '../../src/identity';

describe('test message', () => {
    const restUrl = TEST_ONT_URL_2.REST_URL;

    const privateKey = new PrivateKey('7c47df9664e7db85c1308c080f398400cb24283f5d922e76b478b5429e821b97');
    const identity = Identity.create(privateKey, '123456', '');
    const ontid =  identity.ontid;
    const publicKeyId = ontid + '#keys-1';
    const publicKeyId2 = ontid + '#keys-2';

    let serialized: string;
    let signed: string;

    class TestMessage extends Message {
        static deserialize(jwt: string): TestMessage {
            return super.deserializeInternal(jwt, (m, s) => new TestMessage(m, s));
        }
        payloadToJSON(): any {
            return {};
        }

        // tslint:disable-next-line:no-empty
        payloadFromJSON(json: any): void {
        }
    }

    test('test extractOntId and extractKeyId', () => {
        const extractedOntId = extractOntId(publicKeyId);
        const keyId = extractKeyId(publicKeyId);
        console.log('extracted ont id ' + extractedOntId);

        expect(extractedOntId).toBe(ontid);
        expect(keyId).toBe(1);
    });

    test('test extractOntId and extractKeyId wrong', () => {
        const publicKeyIdWrong = 'did:ont:AXmQDzzvpEtPkNwBEFsREzApTTDZFW6frD#notkeys-1';

        expect(() => {
            extractOntId(publicKeyIdWrong);
        }).toThrowError();

        expect(() => {
            extractKeyId(publicKeyIdWrong);
        }).toThrowError();
    });

    test('test retrievePublicKey successful', async () => {
        await expect(retrievePublicKey(publicKeyId, restUrl)).resolves.toBeDefined();
    }, 10000);

    test('test retrievePublicKey error', async () => {
        await expect(retrievePublicKey(publicKeyId2, restUrl)).rejects.toThrowError();
    });

    test('test unsigned message serialization', async () => {
        const msg: TestMessage = new TestMessage({
            messageId: '1',
            issuer: ontid,
            subject: ontid,
            issuedAt: 1525800823015
        }, undefined);

        serialized = msg.serializeUnsigned();
        expect(serialized).toBeDefined();
    });

    test('test messageId generation', async () => {
        const msg: TestMessage = new TestMessage({
            issuer: ontid,
            subject: ontid,
            issuedAt: 1525800823015
        }, undefined);

        expect(msg.metadata.messageId).toBeDefined();
    });

    test('test signature', async () => {
        const msg: TestMessage = new TestMessage({
            messageId: '1',
            issuer: ontid,
            subject: ontid,
            issuedAt: 1525800823015,
            expireAt: 1849046400
        }, undefined);

        await msg.sign(restUrl, publicKeyId, privateKey);
        signed = msg.serialize();

        expect(msg.signature).toBeDefined();
    });

    test('test signature non existant key', async () => {
        const msg: TestMessage = new TestMessage({
            messageId: '1',
            issuer: ontid,
            subject: ontid,
            issuedAt: 1525800823015
        }, undefined);

        await expect(msg.sign(restUrl, publicKeyId2, privateKey)).rejects.toThrowError();
    });

    test('test unsigned message deserialization', async () => {
        const msg = TestMessage.deserialize(serialized);

        expect(msg.metadata.messageId).toEqual('1');
        expect(msg.metadata.issuer).toEqual(ontid);
        expect(msg.metadata.subject).toEqual(ontid);
        expect(msg.metadata.issuedAt).toEqual(1525800823015);
        expect(msg.signature).toBeUndefined();
    });

    test('test signed message deserialization', async () => {
        const msg = TestMessage.deserialize(signed);

        expect(msg.metadata.messageId).toEqual('1');
        expect(msg.metadata.issuer).toEqual(ontid);
        expect(msg.metadata.subject).toEqual(ontid);
        expect(msg.metadata.issuedAt).toEqual(1525800823015);
        expect(msg.signature).toBeDefined();
        expect(msg.signature!!.algorithm).toBeDefined();
        expect(msg.signature!!.publicKeyId).toBe(publicKeyId);
        expect(msg.signature!!.value).toBeDefined();
    });

    test('test verify', async () => {
        const msg = TestMessage.deserialize(signed);

        const result = await msg.verify(restUrl);

        expect(result).toBeTruthy();
    });

    // todo: needs to create tampered message
    test.skip('test verify tampered', async () => {
        const tampered = signed;
        const msg = TestMessage.deserialize(tampered);

        const result = await msg.verify(restUrl);

        expect(result).toBeFalsy();
    });

    test('test verify JWT with invalid key id', async () => {
        const serializedLocal = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDpvbnQ6VEd' +
            'wb0tHbzI2eG1uQTFpbWdMd0x2WUgybmhXbk42Mkc5dyNrZXlzLTEifQ.eyJqdGkiOiIxIiwiaXNzIjoiZGlkOm9' +
            'udDpUR3BvS0dvMjZ4bW5BMWltZ0x3THZZSDJuaFduTjYyRzl3Iiwic3ViIjoiZGlkOm9udDpUR3BvS0dvMjZ4bW' +
            '5BMWltZ0x3THZZSDJuaFduTjYyRzl3IiwiaWF0IjoxNTI1ODAwODIzLCJleHAiOjE1MjU4MDA4MjR9.7NfItSSE' +
            'pgSDfI8pf6zADaNdc1Dl_tSZoJzYSi21TFL2UKAAwvSHHFtVB7bQfxvaMLEgJ9pU_hP7bYUsiG48Qg';

        const msg = TestMessage.deserialize(serializedLocal);

        const result = await msg.verify(restUrl);

        expect(result).toBeFalsy();
    });

    test('test verify JWT with valid key id', async () => {
        const msg = TestMessage.deserialize(signed);

        const result = await msg.verify(restUrl);

        expect(result).toBeTruthy();
    });
});
