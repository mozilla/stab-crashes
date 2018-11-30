# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import requests


__versions = None


def __get_major(v):
    return int(v.split('.')[0])


def __getVersions():
    """Get the versions number for each channel

    Returns:
        dict: versions for each channel
    """
    r = requests.get('https://product-details.mozilla.org/1.0/firefox_versions.json')
    data = r.json()

    nightly = data['FIREFOX_NIGHTLY']
    esr = data['FIREFOX_ESR_NEXT']
    if not esr:
        esr = data['FIREFOX_ESR']
    if esr.endswith('esr'):
        esr = esr[:-3]

    return {'release': data['LATEST_FIREFOX_VERSION'],
            'beta': data['LATEST_FIREFOX_RELEASED_DEVEL_VERSION'],
            'nightly': nightly,
            'esr': esr}


def get(base=False):
    """Get current version number by channel

    Returns:
        dict: containing version by channel
    """
    global __versions
    if not __versions:
        __versions = __getVersions()

    if base:
        res = {}
        for k, v in __versions.items():
            res[k] = __get_major(v)
        return res

    return __versions


def getStabilityReleases(base):
    r = requests.get('https://product-details.mozilla.org/1.0/firefox_history_stability_releases.json')
    data = r.json()

    return [v for v in data.keys() if v.startswith(base + '.')]


def getDevelopmentReleases(base):
    r = requests.get('https://product-details.mozilla.org/1.0/firefox_history_development_releases.json')
    data = r.json()

    return [v for v in data.keys() if v.startswith(base + '.')]


def get_channel_versions(channel, product='Firefox'):
    channel = channel.lower()
    version = str(get(base=True)[channel])

    if channel == 'nightly':
        return ['{}a1'.format(version)]
    elif channel == 'release':
        return ['{}.0'.format(version)] + getStabilityReleases(version)
    elif channel == 'beta':
        return getDevelopmentReleases(version)
    else:
        assert False, 'Unknown channel {}'.format(channel)
