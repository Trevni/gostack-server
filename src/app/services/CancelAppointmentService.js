import { isBefore, subHours } from 'date-fns';

import User from '../models/User';
import Appointment from '../models/Appointment';

import CancellationMail from '../jobs/CancellationMail';

import Queue from '../../lib/Queue';
import Cache from '../../lib/Cache';

class CancelAppointmentService {
  async run({ provider_id, user_id }) {
    const appointment = await Appointment.findByPk(provider_id, {
      include: [
        { model: User, as: 'provider', attributes: ['name', 'email'] },
        { model: User, as: 'user', attributes: ['name'] },
      ],
    });

    if (appointment.user_id !== user_id) {
      throw new Error("You don't have permission to cancel this appointment.");
    }

    const cancelLimit = subHours(appointment.date, 2);
    if (!isBefore(new Date(), cancelLimit)) {
      throw new Error('You can only cancel appointments 2 hours in advance.');
    }

    appointment.cancelled_at = new Date();
    await appointment.save();

    await Cache.invalidatePrefix(`user:${user_id}:appointments`);

    await Queue.add(CancellationMail.key, { appointment });
  }
}

export default new CancelAppointmentService();
