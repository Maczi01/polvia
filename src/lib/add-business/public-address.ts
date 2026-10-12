import { BlockList, isIP } from 'node:net';

/**
 * Klasyfikacja adresow IP dla guardu SSRF w `safe-fetch.ts` (R17).
 *
 * Bez `server-only`: modul jest czysty, a `node:net` i tak nie trafi do klienta.
 */

const NON_PUBLIC_IPV4 = new BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8], // "ta siec", w tym 0.0.0.0
    ['10.0.0.0', 8], // prywatne
    ['100.64.0.0', 10], // CGNAT
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local, metadane chmury
    ['172.16.0.0', 12], // prywatne
    ['192.0.0.0', 24], // IETF
    ['192.0.2.0', 24], // dokumentacja
    ['192.88.99.0', 24], // 6to4 relay
    ['192.168.0.0', 16], // prywatne
    ['198.18.0.0', 15], // benchmark
    ['198.51.100.0', 24], // dokumentacja
    ['203.0.113.0', 24], // dokumentacja
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // zarezerwowane, w tym broadcast
] as const) {
    NON_PUBLIC_IPV4.addSubnet(network, prefix, 'ipv4');
}

/**
 * IPv6 przepuszczamy tylko z globalnego unicastu 2000::/3. Poza nim zostaja same
 * adresy niepubliczne: ::, ::1, IPv4-mapped (::ffff:0:0/96), NAT64, ULA, link-local
 * i multicast — wiec allowlista jest bezpieczniejsza niz wyliczanie.
 */
const GLOBAL_UNICAST_IPV6 = new BlockList();
GLOBAL_UNICAST_IPV6.addSubnet('2000::', 3, 'ipv6');

/** Wnetrze 2000::/3, ktore zaszywa adres IPv4 albo nie jest routowalne. */
const NON_PUBLIC_IPV6 = new BlockList();
NON_PUBLIC_IPV6.addSubnet('2001::', 32, 'ipv6'); // Teredo
NON_PUBLIC_IPV6.addSubnet('2001:db8::', 32, 'ipv6'); // dokumentacja
NON_PUBLIC_IPV6.addSubnet('2002::', 16, 'ipv6'); // 6to4

/** Czy adres IP jest publicznym unicastem. Nieznany format = nie (fail closed). */
export function isPublicUnicastAddress(address: string): boolean {
    if (address.includes('%')) return false;

    const version = isIP(address);
    if (version === 4) return !NON_PUBLIC_IPV4.check(address, 'ipv4');
    if (version === 6) {
        return (
            GLOBAL_UNICAST_IPV6.check(address, 'ipv6') && !NON_PUBLIC_IPV6.check(address, 'ipv6')
        );
    }
    return false;
}
