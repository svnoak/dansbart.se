export default {
    props: ['token'],
    emits: ['logout'],
    data() {
        return {
            activeTab: 'tracks',
            // Tracks
            tracks: [],
            totalTracks: 0,
            searchQuery: '',
            statusFilter: '',
            flaggedFilter: '',
            limit: 50,
            offset: 0,
            // Ingest
            resourceId: '',
            resourceType: 'playlist',
            loading: false,
            message: '',
            isError: false,
            // Bulk
            bulkLoading: false,
            bulkMessage: '',
            bulkError: false,
            // Spider
            spiderSettings: {
                max_discoveries: 10,
                mode: 'backfill',
                discover_from_albums: true
            },
            spiderLoading: false,
            spiderMessage: '',
            spiderError: false,
            spiderStats: null,
            crawlHistory: [],
            currentTaskId: null,
            taskStatus: null,
            // Toasts
            toasts: [],
            toastId: 0
        }
    },
    mounted() {
        this.loadTracks();
        this.loadSpiderStats();
        this.loadSpiderHistory();
    },
    methods: {
        showToast(message, type = 'success') {
            const id = this.toastId++;
            this.toasts.push({ id, message, type });
            setTimeout(() => {
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, 3000);
        },

        async loadTracks() {
            try {
                const params = new URLSearchParams({
                    limit: this.limit,
                    offset: this.offset
                });
                if (this.searchQuery) params.append('search', this.searchQuery);
                if (this.statusFilter) params.append('status', this.statusFilter);
                if (this.flaggedFilter) params.append('flagged', this.flaggedFilter);

                const res = await fetch(`/api/admin/tracks?${params}`, {
                    headers: { 'x-admin-token': this.token }
                });

                if (!res.ok) throw new Error('Failed to load tracks');

                const data = await res.json();
                this.tracks = data.items.map(t => ({ ...t, loading: false }));
                this.totalTracks = data.total;
            } catch (e) {
                this.showToast('Failed to load tracks', 'error');
            }
        },

        debouncedSearch() {
            clearTimeout(this._searchTimeout);
            this._searchTimeout = setTimeout(() => {
                this.offset = 0;
                this.loadTracks();
            }, 300);
        },

        prevPage() {
            this.offset = Math.max(0, this.offset - this.limit);
            this.loadTracks();
        },

        nextPage() {
            this.offset += this.limit;
            this.loadTracks();
        },

        async reanalyze(track) {
            track.loading = true;
            try {
                const res = await fetch(`/api/admin/tracks/${track.id}/reanalyze`, {
                    method: 'POST',
                    headers: { 'x-admin-token': this.token }
                });

                if (!res.ok) throw new Error('Failed');

                const data = await res.json();
                this.showToast(data.message);
                track.status = 'PENDING';
            } catch (e) {
                this.showToast('Re-analysis failed', 'error');
            } finally {
                track.loading = false;
            }
        },

        async reclassify(track) {
            track.loading = true;
            try {
                const res = await fetch(`/api/admin/tracks/${track.id}/reclassify`, {
                    method: 'POST',
                    headers: { 'x-admin-token': this.token }
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Failed');
                }

                const data = await res.json();
                this.showToast(`${track.title} → ${data.new_style}`);
                track.dance_style = data.new_style;
            } catch (e) {
                this.showToast(e.message, 'error');
            } finally {
                track.loading = false;
            }
        },

        async unflagTrack(track) {
            track.loading = true;
            try {
                const res = await fetch(`/api/tracks/${track.id}/flag`, {
                    method: 'DELETE',
                    headers: { 'x-admin-token': this.token }
                });

                if (!res.ok) throw new Error('Failed to unflag track');

                this.showToast(`Unflagged: ${track.title}`);
                this.loadTracks();
            } catch (e) {
                this.showToast('Failed to unflag track', 'error');
            } finally {
                track.loading = false;
            }
        },

        getPlaceholder() {
            const placeholders = {
                'playlist': 'e.g. 37i9dQZF1DX...',
                'album': 'e.g. 6vV5UrXcfyQD1wu4Qo2I9K',
                'artist': 'e.g. 0TnOYISbd1XYRBk9myaseg'
            };
            return placeholders[this.resourceType] || '';
        },

        getHelpText() {
            const helpTexts = {
                'playlist': 'Find the ID in the Spotify playlist URL',
                'album': 'Find the ID in the Spotify album URL',
                'artist': 'Find the ID in the Spotify artist URL (ingests entire discography)'
            };
            return helpTexts[this.resourceType] || '';
        },

        async runIngest() {
            this.loading = true;
            this.message = '';

            try {
                const res = await fetch('/api/admin/ingest', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': this.token
                    },
                    body: JSON.stringify({
                        resource_id: this.resourceId,
                        resource_type: this.resourceType
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed');

                this.isError = false;
                this.message = `Success: ${data.message}`;
                this.resourceId = '';
                this.loadTracks();
            } catch (e) {
                this.isError = true;
                this.message = e.message;
            } finally {
                this.loading = false;
            }
        },

        async reclassifyAll() {
            this.bulkLoading = true;
            this.bulkMessage = '';

            try {
                const res = await fetch('/api/admin/reclassify-all', {
                    method: 'POST',
                    headers: { 'x-admin-token': this.token }
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed');

                this.bulkError = false;
                this.bulkMessage = data.message;
                this.loadTracks();
            } catch (e) {
                this.bulkError = true;
                this.bulkMessage = e.message;
            } finally {
                this.bulkLoading = false;
            }
        },

        async runSpider() {
            this.spiderLoading = true;
            this.spiderMessage = '';
            this.spiderError = false;

            try {
                const endpoint = this.spiderSettings.mode === 'backfill'
                    ? '/api/admin/spider/backfill'
                    : '/api/admin/spider/search';

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': this.token
                    },
                    body: JSON.stringify(this.spiderSettings)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed');

                this.currentTaskId = data.task_id;
                this.spiderMessage = `Crawl started! Task ID: ${data.task_id}`;
                this.pollTaskStatus(data.task_id);
            } catch (e) {
                this.spiderError = true;
                this.spiderMessage = e.message;
                this.spiderLoading = false;
            }
        },

        async pollTaskStatus(taskId) {
            const poll = async () => {
                try {
                    const res = await fetch(`/api/admin/spider/status/${taskId}`, {
                        headers: { 'x-admin-token': this.token }
                    });

                    const data = await res.json();
                    this.taskStatus = data;

                    if (data.state === 'SUCCESS' || data.state === 'FAILURE') {
                        this.spiderLoading = false;
                        if (data.state === 'SUCCESS') {
                            this.spiderMessage = `Crawl complete! ${JSON.stringify(data.result)}`;
                            this.loadSpiderStats();
                            this.loadSpiderHistory();
                            this.loadTracks();
                        } else {
                            this.spiderError = true;
                            this.spiderMessage = `Crawl failed: ${data.result}`;
                        }
                    } else {
                        setTimeout(poll, 2000);
                    }
                } catch (e) {
                    this.spiderError = true;
                    this.spiderMessage = 'Failed to check task status';
                    this.spiderLoading = false;
                }
            };
            poll();
        },

        async loadSpiderStats() {
            try {
                const res = await fetch('/api/admin/spider/stats', {
                    headers: { 'x-admin-token': this.token }
                });
                if (res.ok) {
                    this.spiderStats = await res.json();
                }
            } catch (e) {
                console.error('Failed to load spider stats', e);
            }
        },

        async loadSpiderHistory() {
            try {
                const res = await fetch('/api/admin/spider/history?limit=10', {
                    headers: { 'x-admin-token': this.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    this.crawlHistory = data.items || [];
                }
            } catch (e) {
                console.error('Failed to load spider history', e);
            }
        },

        formatDate(isoString) {
            if (!isoString) return '-';
            return new Date(isoString).toLocaleString();
        },

        statusClass(status) {
            const classes = {
                'PENDING': 'bg-yellow-600/20 text-yellow-400',
                'PROCESSING': 'bg-blue-600/20 text-blue-400',
                'DONE': 'bg-green-600/20 text-green-400',
                'FAILED': 'bg-red-600/20 text-red-400'
            };
            return classes[status] || 'bg-gray-600/20 text-gray-400';
        },

        statusIcon(status) {
            const icons = {
                'PENDING': '⏳',
                'PROCESSING': '🔄',
                'DONE': '✅',
                'FAILED': '❌'
            };
            return icons[status] || '❓';
        },

        confidenceClass(confidence) {
            if (confidence >= 0.9) return 'text-green-400';
            if (confidence >= 0.75) return 'text-blue-400';
            if (confidence >= 0.5) return 'text-yellow-400';
            return 'text-red-400';
        }
    },
    template: `
        <!-- Template will be added here -->
        <div>Admin panel loaded after authentication</div>
    `
}
