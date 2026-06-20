// ─────────────────────────────────────────────────────
// flightHeightProfile — altitude vs. elapsed-time chart for a flight replay,
// drawn with Chart.js (already loaded via CDN in index.html). Plots the
// backend's recommended altitude (baro when good, else GPS) filled under the
// curve, with a moving vertical cursor synced to the scrubber. Clicking the
// chart seeks (calls on-seek with the nearest index).
//
//   <flight-height-profile track="vm.track" current-index="vm.currentIndex"
//                          on-seek="vm.seekToIndex(i)"></flight-height-profile>
// ─────────────────────────────────────────────────────
app.directive('flightHeightProfile', ['$window', '$timeout', function ($window, $timeout) {
    return {
        restrict: 'E',
        scope: { track: '=', currentIndex: '=', onSeek: '&' },
        template: '<canvas class="fr-profile__canvas"></canvas>',
        link: function (scope, element) {

            var canvas = element[0].querySelector('canvas');
            var chart = null;

            // Chart.js plugin: draw a vertical cursor at the current index.
            var cursorPlugin = {
                id: 'frCursor',
                afterDatasetsDraw: function (c) {
                    var idx = scope.currentIndex || 0;
                    var meta = c.getDatasetMeta(0);
                    if (!meta || !meta.data || !meta.data[idx]) return;
                    var x = meta.data[idx].x;
                    var ctx = c.ctx, top = c.chartArea.top, bot = c.chartArea.bottom;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, top); ctx.lineTo(x, bot);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#1e3a5f';
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x, meta.data[idx].y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#1e3a5f';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.fill(); ctx.stroke();
                    ctx.restore();
                }
            };

            function altOf(p) {
                var a = p.alt_recommended_ft;
                if (a == null) a = p.alt_ft;
                return a || 0;
            }

            function build() {
                if (!scope.track || !scope.track.length || !$window.Chart) return;

                var labels = scope.track.map(function (p) {
                    var s = p.elapsed_s || 0;
                    var m = Math.floor(s / 60);
                    return m + ':' + (('0' + Math.round(s % 60)).slice(-2));
                });
                var data = scope.track.map(altOf);

                var ctx = canvas.getContext('2d');
                var grad = ctx.createLinearGradient(0, 0, 0, 220);
                grad.addColorStop(0, 'rgba(45, 90, 142, 0.35)');
                grad.addColorStop(1, 'rgba(45, 90, 142, 0.02)');

                chart = new $window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            borderColor: '#2d5a8e',
                            backgroundColor: grad,
                            borderWidth: 2,
                            fill: true,
                            pointRadius: 0,
                            tension: 0.25
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        interaction: { intersect: false, mode: 'index' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                displayColors: false,
                                callbacks: {
                                    title: function (items) { return 'T+' + items[0].label; },
                                    label: function (item) { return Math.round(item.parsed.y) + ' ft'; }
                                }
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#94a3b8', font: { size: 10 } } },
                            y: { grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: function (v) { return v + ' ft'; } } }
                        },
                        onClick: function (evt, els, c) {
                            var pts = c.getElementsAtEventForMode(evt, 'index', { intersect: false }, false);
                            if (pts && pts.length) {
                                var i = pts[0].index;
                                scope.$applyAsync(function () { scope.onSeek({ i: i }); });
                            }
                        }
                    },
                    plugins: [cursorPlugin]
                });
            }

            // Build once the track arrives (after the controller's load()).
            var un = scope.$watch('track', function (t) {
                if (t && t.length && !chart) { $timeout(build); }
            });

            // Redraw the cursor as the scrubber moves.
            scope.$watch('currentIndex', function () { if (chart) chart.draw(); });

            // The container height changes when entering/leaving fullscreen.
            // Chart.js's ResizeObserver usually catches this, but force a resize
            // after the CSS transition so the canvas buffer matches its new box
            // (otherwise the labels can look squashed/stretched).
            scope.$on('fr-profile-resize', function () {
                if (!chart) return;
                $timeout(function () { chart.resize(); }, 80);
            });

            scope.$on('$destroy', function () {
                un();
                if (chart) { chart.destroy(); chart = null; }
            });
        }
    };
}]);
