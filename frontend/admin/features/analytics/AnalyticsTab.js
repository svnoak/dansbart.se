/**
 * Analytics Tab Component
 * Displays comprehensive analytics about site usage, track plays, and user interactions
 */

export default {
    data() {
        return {
            loading: true,
            error: null,
            days: 30,
            analytics: null
        }
    },
    mounted() {
        this.fetchAnalytics();
    },
    methods: {
        async fetchAnalytics() {
            this.loading = true;
            this.error = null;

            try {
                const token = localStorage.getItem('admin_token');
                const response = await fetch(`/api/admin/analytics/dashboard?days=${this.days}`, {
                    headers: {
                        'X-Admin-Token': token
                    }
                });
                if (!response.ok) throw new Error('Failed to fetch analytics');

                this.analytics = await response.json();
            } catch (e) {
                this.error = e.message;
                console.error('Analytics fetch error:', e);
            } finally {
                this.loading = false;
            }
        },
        changeDays(newDays) {
            this.days = newDays;
            this.fetchAnalytics();
        }
    },
    template: /*html*/`
    <div class="space-y-4 sm:space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 class="text-xl sm:text-2xl font-bold text-white">📊 Analytics Dashboard</h2>
            <div class="flex gap-2 w-full sm:w-auto">
                <button
                    @click="changeDays(7)"
                    :class="days === 7 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded text-white text-xs sm:text-sm hover:bg-purple-500 transition-colors">
                    7 Days
                </button>
                <button
                    @click="changeDays(30)"
                    :class="days === 30 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded text-white text-xs sm:text-sm hover:bg-purple-500 transition-colors">
                    30 Days
                </button>
                <button
                    @click="changeDays(90)"
                    :class="days === 90 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded text-white text-xs sm:text-sm hover:bg-purple-500 transition-colors">
                    90 Days
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center text-gray-400 py-12">
            <p>Loading analytics...</p>
        </div>

        <div v-else-if="error" class="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
            <p class="font-semibold">Error loading analytics</p>
            <p class="text-sm mt-1">{{ error }}</p>
        </div>

        <div v-else-if="analytics" class="space-y-4 sm:space-y-6">
            <!-- Visitor Stats -->
            <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                <h3 class="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">👥 Visitor Statistics</h3>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Total Visits</p>
                        <p class="text-2xl sm:text-3xl font-bold text-white">{{ analytics.visitors.total_visits }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Unique Visitors</p>
                        <p class="text-2xl sm:text-3xl font-bold text-white">{{ analytics.visitors.unique_visitors }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">New Visitors</p>
                        <p class="text-2xl sm:text-3xl font-bold text-green-400">{{ analytics.visitors.new_visitors }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Returning</p>
                        <p class="text-2xl sm:text-3xl font-bold text-blue-400">{{ analytics.visitors.returning_visitors }}</p>
                    </div>
                </div>
            </div>

            <!-- Listen Time & Platform Stats -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                    <h3 class="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">⏱️ Total Listen Time</h3>
                    <div class="space-y-3">
                        <div>
                            <p class="text-gray-400 text-xs sm:text-sm">Total Hours</p>
                            <p class="text-xl sm:text-2xl font-bold text-white">{{ analytics.listen_time.total_hours }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-xs sm:text-sm">Total Minutes</p>
                            <p class="text-xl sm:text-2xl font-bold text-white">{{ analytics.listen_time.total_minutes }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-xs sm:text-sm">Formatted</p>
                            <p class="text-base sm:text-lg font-mono text-purple-400">{{ analytics.listen_time.formatted }}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                    <h3 class="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">🎵 Platform Usage</h3>
                    <div class="space-y-4">
                        <div v-for="(stats, platform) in analytics.platform_stats" :key="platform">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-semibold capitalize text-sm sm:text-base">{{ platform }}</span>
                                <span class="text-gray-400 text-sm">{{ stats.percentage }}%</span>
                            </div>
                            <div class="bg-gray-900 rounded-full h-2 sm:h-3 overflow-hidden">
                                <div class="bg-purple-600 h-full transition-all" :style="{width: stats.percentage + '%'}"></div>
                            </div>
                            <div class="flex justify-between mt-1 text-xs sm:text-sm text-gray-500">
                                <span>{{ stats.plays }} plays</span>
                                <span>{{ stats.total_duration_minutes }} min</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Most Played Tracks -->
            <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                <h3 class="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">🔥 Most Played Tracks</h3>
                <div class="overflow-x-auto -mx-4 sm:mx-0">
                    <table class="w-full min-w-[600px]">
                        <thead>
                            <tr class="text-left text-gray-400 border-b border-gray-700">
                                <th class="pb-3 pr-2 sm:pr-4 pl-4 sm:pl-0 text-xs sm:text-sm">#</th>
                                <th class="pb-3 pr-2 sm:pr-4 text-xs sm:text-sm">Track</th>
                                <th class="pb-3 pr-2 sm:pr-4 text-xs sm:text-sm">Artist</th>
                                <th class="pb-3 pr-2 sm:pr-4 text-right text-xs sm:text-sm">Plays</th>
                                <th class="pb-3 pr-2 sm:pr-4 text-right text-xs sm:text-sm">Completed</th>
                                <th class="pb-3 pr-4 sm:pr-0 text-right text-xs sm:text-sm">Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(track, index) in analytics.most_played_tracks" :key="track.track_id"
                                class="border-b border-gray-700/50 hover:bg-gray-700/30">
                                <td class="py-3 pr-2 sm:pr-4 pl-4 sm:pl-0 text-gray-400 text-xs sm:text-sm">{{ index + 1 }}</td>
                                <td class="py-3 pr-2 sm:pr-4 text-white font-medium text-xs sm:text-sm">{{ track.track_title }}</td>
                                <td class="py-3 pr-2 sm:pr-4 text-gray-400 text-xs sm:text-sm">{{ track.artist || 'Unknown' }}</td>
                                <td class="py-3 pr-2 sm:pr-4 text-right text-white text-xs sm:text-sm">{{ track.total_plays }}</td>
                                <td class="py-3 pr-2 sm:pr-4 text-right text-green-400 text-xs sm:text-sm">{{ track.completed_plays }}</td>
                                <td class="py-3 pr-4 sm:pr-0 text-right text-xs sm:text-sm">
                                    <span :class="track.completion_rate >= 70 ? 'text-green-400' : track.completion_rate >= 40 ? 'text-yellow-400' : 'text-red-400'">
                                        {{ track.completion_rate }}%
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Help Page Analytics -->
            <div v-if="analytics.help_page" class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                <h3 class="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">❓ Help Page Performance</h3>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Page Views</p>
                        <p class="text-2xl sm:text-3xl font-bold text-white">{{ analytics.help_page.views }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Feedback Given</p>
                        <p class="text-2xl sm:text-3xl font-bold text-white">{{ analytics.help_page.feedback_count }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Helpful</p>
                        <p class="text-2xl sm:text-3xl font-bold text-green-400">{{ analytics.help_page.helpful_count }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-3 sm:p-4">
                        <p class="text-gray-400 text-xs sm:text-sm uppercase mb-1">Not Helpful</p>
                        <p class="text-2xl sm:text-3xl font-bold text-red-400">{{ analytics.help_page.not_helpful_count }}</p>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 text-sm">Helpfulness Rate</span>
                        <span class="text-xl sm:text-2xl font-bold"
                              :class="analytics.help_page.helpfulness_rate >= 70 ? 'text-green-400' : analytics.help_page.helpfulness_rate >= 50 ? 'text-yellow-400' : 'text-red-400'">
                            {{ analytics.help_page.helpfulness_rate }}%
                        </span>
                    </div>
                    <div class="mt-2 bg-gray-900 rounded-full h-2 overflow-hidden">
                        <div class="bg-green-500 h-full transition-all" :style="{width: analytics.help_page.helpfulness_rate + '%'}"></div>
                    </div>
                </div>
            </div>

            <!-- Engagement & Abandonment -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                    <h3 class="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4">💬 Nudge Performance</h3>
                    <div class="space-y-2 sm:space-y-3">
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Shown</span>
                            <span class="text-white font-bold">{{ analytics.nudge_abandonment.nudges_shown }}</span>
                        </div>
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Completed</span>
                            <span class="text-green-400 font-bold">{{ analytics.nudge_abandonment.nudges_completed }}</span>
                        </div>
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Abandoned</span>
                            <span class="text-red-400 font-bold">{{ analytics.nudge_abandonment.nudges_abandoned }}</span>
                        </div>
                        <div class="pt-3 border-t border-gray-700">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400 text-xs sm:text-sm">Completion Rate</span>
                                <span class="text-lg sm:text-xl font-bold"
                                      :class="analytics.nudge_abandonment.completion_rate >= 50 ? 'text-green-400' : 'text-yellow-400'">
                                    {{ analytics.nudge_abandonment.completion_rate }}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                    <h3 class="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4">📝 Modal Performance</h3>
                    <div class="space-y-2 sm:space-y-3">
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Opened</span>
                            <span class="text-white font-bold">{{ analytics.modal_abandonment.modals_opened }}</span>
                        </div>
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Submitted</span>
                            <span class="text-green-400 font-bold">{{ analytics.modal_abandonment.modals_submitted }}</span>
                        </div>
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Abandoned</span>
                            <span class="text-red-400 font-bold">{{ analytics.modal_abandonment.modals_abandoned }}</span>
                        </div>
                        <div class="pt-3 border-t border-gray-700">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400 text-xs sm:text-sm">Completion Rate</span>
                                <span class="text-lg sm:text-xl font-bold"
                                      :class="analytics.modal_abandonment.completion_rate >= 50 ? 'text-green-400' : 'text-yellow-400'">
                                    {{ analytics.modal_abandonment.completion_rate }}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-4 sm:p-6">
                    <h3 class="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4">🚩 Reports</h3>
                    <div class="space-y-2 sm:space-y-3">
                        <div class="flex justify-between text-sm sm:text-base">
                            <span class="text-gray-400">Total Reports</span>
                            <span class="text-white font-bold">{{ analytics.reports.total_reports }}</span>
                        </div>
                        <div class="flex justify-between text-xs sm:text-sm">
                            <span class="text-gray-400">Non-folk tracks</span>
                            <span class="text-white">{{ analytics.reports.track_flags_non_folk }}</span>
                        </div>
                        <div class="flex justify-between text-xs sm:text-sm">
                            <span class="text-gray-400">Broken links</span>
                            <span class="text-white">{{ analytics.reports.broken_link_reports }}</span>
                        </div>
                        <div class="flex justify-between text-xs sm:text-sm">
                            <span class="text-gray-400">Wrong tracks</span>
                            <span class="text-white">{{ analytics.reports.wrong_track_reports }}</span>
                        </div>
                        <div class="flex justify-between text-xs sm:text-sm">
                            <span class="text-gray-400">Spam reports</span>
                            <span class="text-white">{{ analytics.reports.structure_spam_reports }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `
};
