/**
 * @jest-environment node
 */
import { isPublicUnicastAddress } from '@/lib/add-business/public-address';

describe('isPublicUnicastAddress', () => {
    it.each([
        '127.0.0.1',
        '10.0.0.5',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '224.0.0.1',
        '::1',
        '::',
        'fc00::1',
        'fe80::1',
        'ff02::1',
        '::ffff:127.0.0.1',
        '::ffff:8.8.8.8',
        '2002:7f00:1::1',
        'fe80::1%eth0',
        'not-an-ip',
    ])('odrzuca %s', address => {
        expect(isPublicUnicastAddress(address)).toBe(false);
    });

    it.each(['8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4001:82a::200e'])(
        'przepuszcza publiczny %s',
        address => {
            expect(isPublicUnicastAddress(address)).toBe(true);
        },
    );
});
