# -*- coding: utf-8 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import re
import requests
import libmozdata.utils as utils
import libmozdata.versions
import libmozdata.socorro as socorro
from libmozdata.connection import Query


def query_dxr(q):
    r = requests.get('https://dxr.mozilla.org/mozilla-central/search', params={
        'q': q,
        'limit': 1000
    }, headers={
        'Accept': 'application/json'
    })

    if r.status_code != 200:
        print(r.text)
        raise Exception(r)

    return r.json()


def get_critical_errors():
    results = query_dxr('gfxCriticalError(')['results'] + query_dxr('gfxCriticalNote <<')['results'] + query_dxr('gfxCriticalErrorOnce(')['results']

    matches = [re.search(r'"(.*?)"', line['line']) for result in results for line in result['lines']]

    errors = [match.group(1) for match in matches if match is not None]

    return set([error for error in errors if error != ', '])


def analyze_gfx_critical_errors(signature='', product='Firefox', channel=['all'], versions=[], start_date=''):
    if product.lower() == 'firefox':
        product = 'Firefox'

    if channel == [] or channel[0].lower() == 'all':
        channel = ['release', 'beta', 'aurora', 'nightly']
        if product == 'Firefox':
            channel.append('esr')
    else:
        channel = [c.lower() for c in channel]

    if not versions:
        base_versions = libmozdata.versions.get(base=True)
        versions_by_channel = socorro.ProductVersions.get_info_from_major(base_versions, product=product)
        versions = []
        for v1 in versions_by_channel.values():
            for v2 in v1:
                versions.append(v2['version'])

    if not start_date:
        start_date = utils.get_date('today', 7)

    gfx_critical_errors = get_critical_errors()

    count = {}

    def handler(json, gfx_critical_error):
        count[gfx_critical_error] = json['total']

    base_params = {
        'product': product,
        'release_channel': channel,
        'version': versions,
        'date': '>=' + start_date,
        '_results_number': 0,
        '_facets_size': 0,
    }

    if signature:
        base_params['signature'] = signature

    queries = []
    for gfx_critical_error in gfx_critical_errors:
        params = base_params.copy()
        params['graphics_critical_error'] = '~' + gfx_critical_error
        queries.append(Query(socorro.SuperSearch.URL, params=params, handler=handler, handlerdata=gfx_critical_error))

    socorro.SuperSearch(queries=queries).wait()

    return count
