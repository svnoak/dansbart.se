/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics about site usage, track plays, and user interactions
 */

import { showError } from '../hooks/useToast';

export default {
  data() {
    return {
      loading: true,
      error: null,
      days: 30,
      analytics: null,
    };
  },
  mounted() {
    this.fetchAnalytics();
  },
  methods: {
    async fetchAnalytics() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`/api/analytics/dashboard?days=${this.days}`);
        if (!response.ok) throw new Error('Failed to fetch analytics');

        this.analytics = await response.json();
      } catch (e) {
        this.error = e.message;
        showError(e.message);
      } finally {
        this.loading = false;
      }
    },
    changeDays(newDays) {
      this.days = newDays;
      this.fetchAnalytics();
    },
  },
  template: /*html*/ `
    <div class="max-w-7xl mx-auto p-6 space-y-6">
        <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-white">Analytics Dashboard</h1>
            <div class="flex gap-2">
                <button
                    @click="changeDays(7)"
                    :class="days === 7 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="px-4 py-2 rounded text-white text-sm hover:bg-purple-500 transition-colors">
                    7 Days
                </button>
                <button
                    @click="changeDays(30)"
                    :class="days === 30 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="px-4 py-2 rounded text-white text-sm hover:bg-purple-500 transition-colors">
                    30 Days
                </button>
                <button
                    @click="changeDays(90)"
                    :class="days === 90 ? 'bg-purple-600' : 'bg-gray-700'"
                    class="px-4 py-2 rounded text-white text-sm hover:bg-purple-500 transition-colors">
                    90 Days
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center text-gray-400 py-12">
            <p>Loading analytics...</p>
        </div>

        <div v-else-if="error" class="text-center text-red-400 py-12">
            <p>Error: {{ error }}</p>
        </div>

        <div v-else-if="analytics" class="space-y-6">
            <!-- Visitor Stats -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h2 class="text-xl font-bold text-white mb-4">Visitor Statistics</h2>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-gray-900/50 rounded p-4">
                        <p class="text-gray-400 text-sm uppercase mb-1">Total Visits</p>
                        <p class="text-3xl font-bold text-white">{{ analytics.visitors.total_visits }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-4">
                        <p class="text-gray-400 text-sm uppercase mb-1">Unique Visitors</p>
                        <p class="text-3xl font-bold text-white">{{ analytics.visitors.unique_visitors }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-4">
                        <p class="text-gray-400 text-sm uppercase mb-1">New Visitors</p>
                        <p class="text-3xl font-bold text-green-400">{{ analytics.visitors.new_visitors }}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded p-4">
                        <p class="text-gray-400 text-sm uppercase mb-1">Returning Visitors</p>
                        <p class="text-3xl font-bold text-blue-400">{{ analytics.visitors.returning_visitors }}</p>
                    </div>
                </div>
            </div>

            <!-- Listen Time & Platform Stats -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h2 class="text-xl font-bold text-white mb-4">Total Listen Time</h2>
                    <div class="space-y-3">
                        <div>
                            <p class="text-gray-400 text-sm">Total Hours</p>
                            <p class="text-2xl font-bold text-white">{{ analytics.listenTime?.totalHours }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">Total Minutes</p>
                            <p class="text-2xl font-bold text-white">{{ analytics.listenTime?.totalMinutes }}</p>
                        </div>
                        <div>
                            <p class="text-gray-400 text-sm">Formatted</p>
                            <p class="text-lg font-mono text-purple-400">{{ analytics.listenTime?.formatted }}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h2 class="text-xl font-bold text-white mb-4">Platform Usage</h2>
                    <div class="space-y-4">
                        <div v-for="(stats, platform) in analytics.platformStats" :key="platform">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-semibold capitalize">{{ platform }}</span>
                                <span class="text-gray-400">{{ stats.percentage }}%</span>
                            </div>
                            <div class="bg-gray-900 rounded-full h-3 overflow-hidden">
                                <div class="bg-purple-600 h-full transition-all" :style="{width: stats.percentage + '%'}"></div>
                            </div>
                            <div class="flex justify-between mt-1 text-sm text-gray-500">
                                <span>{{ stats.plays }} plays</span>
                                <span>{{ stats.totalDurationMinutes }} min</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Most Played Tracks -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h2 class="text-xl font-bold text-white mb-4">Most Played Tracks</h2>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="text-left text-gray-400 border-b border-gray-700">
                                <th class="pb-3 pr-4">#</th>
                                <th class="pb-3 pr-4">Track</th>
                                <th class="pb-3 pr-4">Artist</th>
                                <th class="pb-3 pr-4 text-right">Total Plays</th>
                                <th class="pb-3 pr-4 text-right">Completed</th>
                                <th class="pb-3 text-right">Completion Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(track, index) in analytics.mostPlayedTracks" :key="track.trackId"
                                class="border-b border-gray-700/50 hover:bg-gray-700/30">
                                <td class="py-3 pr-4 text-gray-400">{{ index + 1 }}</td>
                                <td class="py-3 pr-4 text-white font-medium">{{ track.title }}</td>
                                <td class="py-3 pr-4 text-gray-400">{{ track.artist || 'Unknown' }}</td>
                                <td class="py-3 pr-4 text-right text-white">{{ track.playCount }}</td>
                                <td class="py-3 pr-4 text-right text-green-400">{{ track.completedPlays }}</td>
                                <td class="py-3 text-right">
                                    <span :class="track.completionRate >= 70 ? 'text-green-400' : track.completionRate >= 40 ? 'text-yellow-400' : 'text-red-400'">
                                        {{ track.completionRate }}%
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Engagement & Abandonment -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h2 class="text-xl font-bold text-white mb-4">Nudge Performance</h2>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Shown</span>
                            <span class="text-white font-bold">{{ analytics.nudge_abandonment.nudges_shown }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Completed</span>
                            <span class="text-green-400 font-bold">{{ analytics.nudge_abandonment.nudges_completed }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Abandoned</span>
                            <span class="text-red-400 font-bold">{{ analytics.nudge_abandonment.nudges_abandoned }}</span>
                        </div>
                        <div class="pt-3 border-t border-gray-700">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400">Completion Rate</span>
                                <span class="text-xl font-bold"
                                      :class="analytics.nudge_abandonment.completion_rate >= 50 ? 'text-green-400' : 'text-yellow-400'">
                                    {{ analytics.nudge_abandonment.completion_rate }}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h2 class="text-xl font-bold text-white mb-4">Modal Performance</h2>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Opened</span>
                            <span class="text-white font-bold">{{ analytics.modal_abandonment.modals_opened }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Submitted</span>
                            <span class="text-green-400 font-bold">{{ analytics.modal_abandonment.modals_submitted }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Abandoned</span>
                            <span class="text-red-400 font-bold">{{ analytics.modal_abandonment.modals_abandoned }}</span>
                        </div>
                        <div class="pt-3 border-t border-gray-700">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400">Completion Rate</span>
                                <span class="text-xl font-bold"
                                      :class="analytics.modal_abandonment.completion_rate >= 50 ? 'text-green-400' : 'text-yellow-400'">
                                    {{ analytics.modal_abandonment.completion_rate }}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h2 class="text-xl font-bold text-white mb-4">Reports</h2>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Total Reports</span>
                            <span class="text-white font-bold">{{ analytics.reports.total_reports }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400 text-sm">Non-folk tracks</span>
                            <span class="text-white">{{ analytics.reports.track_flags_non_folk }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400 text-sm">Broken links</span>
                            <span class="text-white">{{ analytics.reports.broken_link_reports }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400 text-sm">Wrong tracks</span>
                            <span class="text-white">{{ analytics.reports.wrong_track_reports }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400 text-sm">Spam reports</span>
                            <span class="text-white">{{ analytics.reports.structure_spam_reports }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
};
