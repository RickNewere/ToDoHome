package it.ricknewere.todohome.data

/** One row of the `chore_status` view. Postgres already computed the due date
 *  and the lateness, so the widget only has to render them. */
data class ChoreStatus(
    val id: String,
    val name: String,
    val emoji: String,
    /** Positive when overdue, 0 when due today, negative when still upcoming. */
    val daysLate: Int,
    val riccardoChecked: Boolean,
    val robertaChecked: Boolean,
) {
    val isLate: Boolean get() = daysLate > 0
    val isDueToday: Boolean get() = daysLate == 0
    /** Needs attention: either overdue or due today. */
    val isPending: Boolean get() = daysLate >= 0

    fun checkedBy(user: String?): Boolean = when (user) {
        "riccardo" -> riccardoChecked
        "roberta" -> robertaChecked
        else -> false
    }

    fun checkedByPartnerOf(user: String?): Boolean = when (user) {
        "riccardo" -> robertaChecked
        "roberta" -> riccardoChecked
        else -> false
    }

    /** Copy with [user]'s tick already set, used to paint the widget the moment
     *  the button is pressed instead of waiting for the round trip. */
    fun withTickFrom(user: String?): ChoreStatus = when (user) {
        "riccardo" -> copy(riccardoChecked = true)
        "roberta" -> copy(robertaChecked = true)
        else -> this
    }

    /** Short badge shown on the right of a widget row. */
    fun badge(): String = when {
        daysLate > 0 -> "+${daysLate}g"
        daysLate == 0 -> "oggi"
        daysLate == -1 -> "domani"
        else -> "${-daysLate}g"
    }
}

/** How angry Casimiro is. Thresholds mirror computeMood in web/src/lib/chores.ts. */
enum class Mood {
    HAPPY, CALM, ANNOYED, ANGRY, FURIOUS;

    val title: String
        get() = when (this) {
            HAPPY -> "Casa in ordine"
            CALM -> "Tutto sotto controllo"
            ANNOYED -> "Qualcosa manca"
            ANGRY -> "Datevi una mossa"
            FURIOUS -> "Casa allo sbando"
        }

    companion object {
        fun of(chores: List<ChoreStatus>): Mood {
            val late = chores.filter { it.isLate }
            val dueToday = chores.count { it.isDueToday }
            val worst = late.maxOfOrNull { it.daysLate } ?: 0

            return when {
                late.isEmpty() -> if (dueToday == 0) HAPPY else CALM
                late.size <= 1 && worst <= 2 -> ANNOYED
                late.size <= 3 && worst <= 4 -> ANGRY
                else -> FURIOUS
            }
        }
    }
}
