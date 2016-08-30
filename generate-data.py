# -*- coding: utf-8 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import argparse
import json
import six
import functools
from datetime import (datetime, timedelta)
import os
from libmozdata import config
import libmozdata.socorro as socorro
import libmozdata.utils as utils
from libmozdata.redash import Redash
from libmozdata.connection import (Connection, Query)
from libmozdata.bugzilla import Bugzilla
import libmozdata.versions

v = libmozdata.versions.get(base=True)

# http://bugs.python.org/issue7980
datetime.strptime('', '')


def __trend_handler(default_trend, json, data):
    for facets in json['facets']['histogram_date']:
        d = utils.as_utc(datetime.strptime(facets['term'], '%Y-%m-%dT00:00:00+00:00'))
        s = facets['facets']['signature']
        for signature in s:
            count = signature['count']
            sgn = signature['term']
            if sgn in data:
                data[sgn][d] = count
            else:
                trend = default_trend.copy()
                trend[d] = count
                data[sgn] = trend


def __bug_handler(json, data):
    for bug in json['bugs']:
        data.append(bug)


def get(channel, date, product='Firefox', duration=11, tc_limit=50, crash_type='all', startup=False):
    """Get crashes info

    Args:
        channel (str): the channel
        date (str): the final date
        product (Optional[str]): the product
        duration (Optional[int]): the duration to retrieve the data
        tc_limit (Optional[int]): the number of topcrashes to load
        crash_type (Optional[str]): 'all' (default) or 'browser' or 'content' or 'plugin'

    Returns:
        dict: contains all the info relative to the crashes
    """
    channel = channel.lower()
    version = v[channel]
    sys.stdout.write('Getting version information from Socorro...')
    sys.stdout.flush()
    versions_info = socorro.ProductVersions.get_version_info(version, channel=channel, product=product)
    versions = versions_info.keys()
    platforms = socorro.Platforms.get_cached_all()
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    if crash_type and isinstance(crash_type, six.string_types):
        crash_type = [crash_type]

    throttle = set(map(lambda p: p[1], versions_info.values()))
    if len(throttle) == 1:
        throttle = throttle.pop()
    else:
        return

    _date = utils.get_date_ymd(date)
    start_date = utils.get_date_str(_date - timedelta(duration - 1))
    end_date = utils.get_date_str(_date)

    # First, we get the ADI
    sys.stdout.write('Getting ADI from Socorro...')
    sys.stdout.flush()
    adi = socorro.ADI.get(version=versions, product=product, end_date=end_date, duration=duration, platforms=platforms)
    adi = [adi[key] for key in sorted(adi.keys(), reverse=True)]
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    # get the khours
    sys.stdout.write('Getting khours from Re:dash...')
    sys.stdout.flush()
    khours = Redash.get_khours(utils.get_date_ymd(start_date), utils.get_date_ymd(end_date), channel, versions, product)
    khours = [khours[key] for key in sorted(khours.keys(), reverse=True)]
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    overall_crashes_by_day = []
    signatures = {}

    def signature_handler(json):
        for signature in json['facets']['signature']:
            signatures[signature['term']] = [signature['count'], 0, 0, 0, 0]

            for platform in signature['facets']['platform']:
                if platform['term'] == 'Linux':
                    signatures[signature['term']][3] = platform['count']
                elif platform['term'] == 'Windows NT':
                    signatures[signature['term']][1] = platform['count']
                elif platform['term'] == 'Mac OS X':
                    signatures[signature['term']][2] = platform['count']

            for uptime in signature['facets']['uptime']:
                if int(uptime['term']) < 60:
                    signatures[signature['term']][4] += uptime['count']

        for facets in json['facets']['histogram_date']:
            overall_crashes_by_day.insert(0, facets['count'])

    params = {
        'product': product,
        'version': versions,
        'date': socorro.SuperSearch.get_search_date(start_date, end_date),
        'release_channel': channel,
        '_aggs.signature': ['platform', 'uptime'],
        '_results_number': 0,
        '_facets_size': tc_limit,
        '_histogram.date': ['product'],
        '_histogram_interval': 1
    }

    if startup:
        params['uptime'] = '<=60'

    sys.stdout.write('Getting top signatures from Socorro...')
    sys.stdout.flush()
    socorro.SuperSearch(params=params, handler=signature_handler).wait()
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    bug_flags = ['resolution', 'id', 'last_change_time', 'cf_tracking_firefox' + str(version)]
    for i in range(int(version), int(v['nightly']) + 1):
        bug_flags.append('cf_status_firefox' + str(i))

    # TODO: too many requests... should be improved with chunks
    bugs = {}
    # TODO: Use regexp, when the Bugzilla bug that prevents them from working will be fixed.
    base = {
        'j_top': 'OR',
        'o1': 'substring',
        'f1': 'cf_crash_signature',
        'v1': None,
        'o2': 'substring',
        'f2': 'cf_crash_signature',
        'v2': None,
        'o3': 'substring',
        'f3': 'cf_crash_signature',
        'v3': None,
        'o4': 'substring',
        'f4': 'cf_crash_signature',
        'v4': None,
        'include_fields': bug_flags
    }

    queries = []
    for sgn in signatures.keys():
        cparams = base.copy()
        cparams['v1'] = '[@' + sgn + ']'
        cparams['v2'] = '[@ ' + sgn + ' ]'
        cparams['v3'] = '[@ ' + sgn + ']'
        cparams['v4'] = '[@' + sgn + ' ]'
        bugs[sgn] = []
        queries.append(Query(Bugzilla.API_URL, cparams, __bug_handler, bugs[sgn]))
    res_bugs = Bugzilla(queries=queries)

    # we have stats by signature in self.signatures
    # for each signature get the number of crashes on the last X days
    # so get the signature trend
    trends = {}
    default_trend = {}
    for i in range(duration):
        default_trend[_date - timedelta(i)] = 0

    base = {'product': product,
            'version': versions,
            'signature': None,
            'date': socorro.SuperSearch.get_search_date(start_date, end_date),
            'release_channel': channel,
            '_results_number': 0,
            '_histogram.date': ['signature'],
            '_histogram_interval': 1}

    queries = []
    for sgns in Connection.chunks(list(map(lambda sgn: '=' + sgn, signatures.keys())), 10):
        sgn_group = []
        for sgn in sgns:
            if sum(len(s) for s in sgn_group) >= 1000:
                cparams = base.copy()
                cparams['signature'] = sgn_group
                queries.append(Query(socorro.SuperSearch.URL, cparams, functools.partial(__trend_handler, default_trend), trends))
                sgn_group = []

            sgn_group.append(sgn)

        if len(sgn_group) > 0:
            cparams = base.copy()
            cparams['signature'] = sgn_group
            queries.append(Query(socorro.SuperSearch.URL, cparams, functools.partial(__trend_handler, default_trend), trends))

    sys.stdout.write('Getting trends for top signatures from Socorro...')
    sys.stdout.flush()
    socorro.SuperSearch(queries=queries).wait()
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    for sgn, trend in trends.items():
        signatures[sgn] = (signatures[sgn], [trend[key] for key in sorted(trend.keys(), reverse=True)])

    _signatures = {}
    # order self.signatures by crash count
    l = sorted(signatures.items(), key=lambda x: x[1][0][0], reverse=True)
    i = 1
    for s in l:
        _signatures[s[0]] = i  # top crash rank
        i += 1

    sys.stdout.write('Getting bugs linked to the top signatures from Bugzilla...')
    sys.stdout.flush()
    res_bugs.wait()
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    # TODO: In the first query to get the bugs, also get dupe_of and avoid the first query
    #       in follow_dup (so modify follow_dup to accept both a bug ID or a bug object).
    queries = []
    for sgn in signatures.keys():
        duplicate_ids = [bug['id'] for bug in bugs[sgn] if bug['resolution'] == 'DUPLICATE']

        # Remove bugs resolved as DUPLICATE from the list of bugs associated to the signature.
        bugs[sgn] = [bug for bug in bugs[sgn] if bug['id'] not in duplicate_ids]

        # Find duplicates for bugs resolved as DUPLICATE.
        duplicates = {k: v for k, v in Bugzilla.follow_dup(duplicate_ids).items() if v is not None}
        duplicate_targets = [bug_id for bug_id in duplicates.values() if int(bug_id) not in [bug['id'] for bug in bugs[sgn]]]
        if len(duplicate_targets) == 0:
            continue

        # Get info about bugs that the DUPLICATE bugs have been duped to.
        params = {
            'id': ','.join(duplicate_targets),
            'include_fields': bug_flags,
        }
        queries.append(Query(Bugzilla.API_URL, params, __bug_handler, bugs[sgn]))
    sys.stdout.write('Resolving duplicate bugs to the bugs they\'ve been duplicated to...')
    sys.stdout.flush()
    Bugzilla(queries=queries).wait()
    sys.stdout.write(' ✔\n')
    sys.stdout.flush()

    for sgn, stats in signatures.items():
        # stats is 2-uple: ([count, win_count, mac_count, linux_count, startup_count], trend)
        startup_percent = float(stats[0][4]) / float(stats[0][0])
        _signatures[sgn] = {'tc_rank': _signatures[sgn],
                            'crash_count': stats[0][0],
                            'startup_percent': startup_percent,
                            'crash_by_day': stats[1],
                            'bugs': bugs[sgn]}

    return {
        'start_date': start_date,
        'end_date': end_date,
        'versions': list(versions),
        'adi': adi,
        'khours': khours,
        'crash_by_day': overall_crashes_by_day,
        'signatures': _signatures,
        'throttle': float(throttle)
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Track')
    parser.add_argument('-o', '--output-directory', action='store', required=True, help='the output directory')
    parser.add_argument('-c', '--channels', action='store', nargs='+', default=['release', 'beta', 'aurora', 'nightly'], help='the channels')
    parser.add_argument('-d', '--date', action='store', default='yesterday_utc', help='the end date')
    parser.add_argument('-D', '--duration', action='store', default=11, help='the duration')
    parser.add_argument('-t', '--tclimit', action='store', default=100, help='number of top crashes to retrieve')

    args = parser.parse_args()

    config.set_config(config.ConfigIni('config.ini'))

    for channel in args.channels:
        for startup in [False, True]:
            print('Getting top-' + str(args.tclimit) + (' startup ' if startup else ' ') + 'crashes for the \'' + channel + '\' channel')

            stats = get(channel, args.date, duration=int(args.duration), tc_limit=int(args.tclimit), startup=startup)

            print('\n\n')

            with open('dist/' + channel + ('-startup' if startup else '') + '.json', 'w') as f:
                json.dump(stats, f, allow_nan=False)
