const Followup = require('../models/Followup');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Notification = require('../models/Notification');
const moment = require('moment');

// GET /api/followups
exports.getFollowups = async (req, res) => {
  try {
    const { date, status, assignedTo, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role === 'member') query.assignedTo = req.user._id;
    else if (assignedTo) query.assignedTo = assignedTo;

    if (status) query.status = status;

    if (date) {
      const day = moment(date).startOf('day').toDate();
      const nextDay = moment(date).endOf('day').toDate();
      query.scheduledDate = { $gte: day, $lte: nextDay };
    }

    const total = await Followup.countDocuments(query);
    const followups = await Followup.find(query)
      .populate('lead', 'name phone email status priority')
      .populate('assignedTo', 'name avatar')
      .populate('assignedBy', 'name')
      .sort({ scheduledDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, followups, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/followups/today
exports.getTodayFollowups = async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const tomorrow = moment().endOf('day').toDate();
    const query = {
      scheduledDate: { $gte: today, $lte: tomorrow }
    };
    if (req.user.role === 'member') query.assignedTo = req.user._id;

    const followups = await Followup.find(query)
      .populate('lead', 'name phone email status priority webinarStatus')
      .populate('assignedTo', 'name avatar')
      .sort({ scheduledDate: 1 });

    const stats = {
      total: followups.length,
      completed: followups.filter(f => f.status === 'completed').length,
      pending: followups.filter(f => f.status === 'pending').length,
      missed: followups.filter(f => f.status === 'missed').length
    };

    res.json({ success: true, followups, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/followups/missed
exports.getMissedFollowups = async (req, res) => {
  try {
    const now = new Date();
    const query = {
      scheduledDate: { $lt: now },
      status: { $in: ['pending', 'missed'] }
    };
    if (req.user.role === 'member') query.assignedTo = req.user._id;

    // Auto-mark as missed
    await Followup.updateMany(
      { scheduledDate: { $lt: now }, status: 'pending' },
      { status: 'missed' }
    );

    const missed = await Followup.find({ ...query, status: 'missed' })
      .populate('lead', 'name phone email status priority')
      .populate('assignedTo', 'name avatar')
      .sort({ scheduledDate: -1 })
      .limit(50);

    res.json({ success: true, followups: missed, count: missed.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/followups
exports.createFollowup = async (req, res) => {
  try {
    const { lead: leadId, assignedTo, scheduledDate, type, remark, priority } = req.body;
    const followup = await Followup.create({
      lead: leadId, assignedTo, assignedBy: req.user._id,
      scheduledDate, type, remark, priority
    });

    // Update lead's next followup date
    await Lead.findByIdAndUpdate(leadId, {
      nextFollowupDate: scheduledDate,
      $inc: { followupCount: 1 }
    });

    await User.findByIdAndUpdate(assignedTo, { $inc: { 'stats.totalFollowups': 1 } });

    // Notify
    await Notification.create({
      user: assignedTo, type: 'upcoming_followup',
      title: 'New Followup Scheduled',
      message: `Followup scheduled for ${moment(scheduledDate).format('DD MMM YYYY, hh:mm A')}`,
      relatedFollowup: followup._id
    });

    const populated = await Followup.findById(followup._id)
      .populate('lead', 'name phone email status')
      .populate('assignedTo', 'name avatar');
    res.status(201).json({ success: true, followup: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/followups/:id/complete
exports.completeFollowup = async (req, res) => {
  try {
    const { outcome, remark, duration, nextFollowupDate, nextFollowupType } = req.body;
    const followup = await Followup.findById(req.params.id);
    if (!followup) return res.status(404).json({ success: false, message: 'Followup not found' });

    followup.status = 'completed';
    followup.outcome = outcome;
    followup.remark = remark;
    followup.duration = duration || 0;
    followup.completedAt = new Date();
    followup.completedBy = req.user._id;
    await followup.save();

    // Update lead status based on outcome
    const statusMap = {
      interested: 'interested', not_interested: 'not_interested',
      nurturing: 'nurturing', converted: 'converted'
    };
    const leadUpdate = {
      lastFollowupDate: new Date(),
      latestRemark: remark,
      $inc: { callCount: 1 }
    };
    if (statusMap[outcome]) leadUpdate.status = statusMap[outcome];
    if (remark) leadUpdate.$push = { remarks: { text: remark, addedBy: req.user._id } };
    if (nextFollowupDate) leadUpdate.nextFollowupDate = nextFollowupDate;

    await Lead.findByIdAndUpdate(followup.lead, leadUpdate);
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.completedFollowups': 1 } });

    // Schedule next followup if provided
    if (nextFollowupDate && followup.assignedTo) {
      await Followup.create({
        lead: followup.lead, assignedTo: followup.assignedTo,
        assignedBy: req.user._id, scheduledDate: nextFollowupDate,
        type: nextFollowupType || 'call', priority: followup.priority
      });
    }

    const updated = await Followup.findById(followup._id)
      .populate('lead', 'name phone email status')
      .populate('assignedTo', 'name avatar');
    res.json({ success: true, followup: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/followups/:id/reschedule
exports.rescheduleFollowup = async (req, res) => {
  try {
    const { rescheduledTo, rescheduledReason } = req.body;
    const followup = await Followup.findByIdAndUpdate(req.params.id, {
      status: 'rescheduled', rescheduledTo, rescheduledReason, scheduledDate: rescheduledTo
    }, { new: true }).populate('lead', 'name phone').populate('assignedTo', 'name avatar');

    await Lead.findByIdAndUpdate(followup.lead._id, { nextFollowupDate: rescheduledTo });
    res.json({ success: true, followup });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/followups/stats
exports.getFollowupStats = async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const tomorrow = moment().endOf('day').toDate();
    const weekStart = moment().startOf('week').toDate();
    const monthStart = moment().startOf('month').toDate();

    const matchUser = req.user.role === 'member' ? { assignedTo: req.user._id } : {};

    const [todayStats, weekStats, monthStats, missed] = await Promise.all([
      Followup.aggregate([
        { $match: { ...matchUser, scheduledDate: { $gte: today, $lte: tomorrow } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Followup.countDocuments({ ...matchUser, scheduledDate: { $gte: weekStart }, status: 'completed' }),
      Followup.countDocuments({ ...matchUser, scheduledDate: { $gte: monthStart }, status: 'completed' }),
      Followup.countDocuments({ ...matchUser, scheduledDate: { $lt: today }, status: 'missed' })
    ]);

    const todayMap = todayStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
    res.json({
      success: true,
      today: { total: Object.values(todayMap).reduce((a, b) => a + b, 0), ...todayMap },
      weekCompleted: weekStats,
      monthCompleted: monthStats,
      totalMissed: missed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
