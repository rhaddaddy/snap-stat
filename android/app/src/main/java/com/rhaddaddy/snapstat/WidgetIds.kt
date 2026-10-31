package com.rhaddaddy.snapstat

/** Which texts in the two widget layouts are which, so each can take the app's colours (see Widget.paint). */
internal object WidgetIds {
    // Main text (names and numbers)
    val FG_SMALL = intArrayOf(R.id.w_name, R.id.w_today)
    val FG_BIG = intArrayOf(R.id.w_name, R.id.w_today, R.id.w_seasonrec, R.id.w_event, R.id.w_money, R.id.w_ally, R.id.w_webbtn)
    // Labels and second lines
    val MUTED_SMALL = intArrayOf(R.id.w_ls1, R.id.w_season, R.id.w_ls2, R.id.w_ls3, R.id.w_reset_at)
    val MUTED_BIG = intArrayOf(R.id.w_lbig1, R.id.w_lbig2, R.id.w_lbig3, R.id.w_lbig4, R.id.w_lbig5, R.id.w_lbig6, R.id.w_lbig7, R.id.w_lbig8, R.id.w_lbig9,
        R.id.w_season, R.id.w_rank_sub, R.id.w_today_sub, R.id.w_reset_at, R.id.w_season_sub, R.id.w_refresh_at, R.id.w_event_sub, R.id.w_web_sub, R.id.w_money_sub, R.id.w_ally_sub)
    // The countdowns
    val COUNT_SMALL = intArrayOf(R.id.w_reset)
    val COUNT_BIG = intArrayOf(R.id.w_reset, R.id.w_refresh)
    // The panels on the big widget, and the Web shop button that looks like one
    val TILES = intArrayOf(R.id.w_t_today, R.id.w_t_reset, R.id.w_t_season, R.id.w_t_refresh, R.id.w_t_event, R.id.w_t_web, R.id.w_t_money, R.id.w_t_ally, R.id.w_webbtn)
}
