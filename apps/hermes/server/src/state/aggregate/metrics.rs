use {
    super::Slot,
    prometheus_client::{
        encoding::{EncodeLabelSet, EncodeLabelValue},
        metrics::{counter::Counter, family::Family, histogram::Histogram},
        registry::Registry,
    },
    std::collections::{BTreeMap, HashMap},
    tokio::time::Instant,
};

const MAX_SLOT_OBSERVATIONS: usize = 1000;

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
pub enum SlotOrder {
    New,
    OutOfOrder,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
pub enum Event {
    Vaa,
    AccumulatorMessages,
    CompletedUpdate,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct ObservedSlotLabels {
    pub order: SlotOrder,
    pub event: Event,
}

#[derive(Clone, Debug)]
pub struct Metrics {
    observed_slot: Family<ObservedSlotLabels, Counter>,
    observed_slot_latency: Family<ObservedSlotLabels, Histogram>,
    publish_to_receive_latency: Histogram,
    first_observed_time_of_slot: BTreeMap<Slot, Instant>,
    newest_observed_slot: HashMap<Event, Slot>,
}

impl Metrics {
    pub fn new(metrics_registry: &mut Registry) -> Self {
        let new = Self {
            observed_slot: Family::default(),
            observed_slot_latency: Family::new_with_constructor(|| {
                Histogram::new(
                    [
                        0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.3, 1.7, 2.0, 3.0, 5.0, 10.0, 20.0,
                    ]
                    .into_iter(),
                )
            }),
            publish_to_receive_latency: Histogram::new(
                [
                    0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.3, 1.7, 2.0, 3.0, 5.0, 10.0, 20.0,
                ]
                .into_iter(),
            ),
            first_observed_time_of_slot: BTreeMap::new(),
            newest_observed_slot: HashMap::new(),
        };

        {
            let observed_slot = new.observed_slot.clone();
            let observed_slot_latency = new.observed_slot_latency.clone();

            metrics_registry.register(
                "aggregate_observed_slot",
                "Total number of observed slots",
                observed_slot,
            );

            metrics_registry.register(
                "aggregate_observed_slot_latency_seconds",
                "Latency of observed slots in seconds",
                observed_slot_latency,
            );

            metrics_registry.register(
                "publish_to_receive_latency_seconds",
                "Latency from message publish_time to Hermes receive_time in seconds",
                new.publish_to_receive_latency.clone(),
            );
        }

        new
    }

    pub fn observe_publish_to_receive(&mut self, latency_secs: i64) {
        // Histogram only accepts f64. The conversion is safe (never panics), but very large values lose precision.
        let latency_secs = latency_secs as f64;
        if latency_secs.is_finite() && latency_secs >= 0.0 {
            self.publish_to_receive_latency.observe(latency_secs);
        }
    }

    /// Observe a slot and event. An event at a slot should be observed only once.
    pub fn observe(&mut self, slot: Slot, event: Event) {
        let order = if self
            .newest_observed_slot
            .get(&event)
            .is_none_or(|&observed_slot| slot > observed_slot)
        {
            self.newest_observed_slot.insert(event.clone(), slot);
            SlotOrder::New
        } else {
            SlotOrder::OutOfOrder
        };

        let labels = ObservedSlotLabels { order, event };

        self.observed_slot.get_or_create(&labels).inc();

        if let Some(start) = self.first_observed_time_of_slot.get(&slot) {
            let latency = start.elapsed().as_secs_f64();
            self.observed_slot_latency
                .get_or_create(&labels)
                .observe(latency);
        } else {
            self.first_observed_time_of_slot
                .insert(slot, Instant::now());
            self.observed_slot_latency
                .get_or_create(&labels)
                .observe(0.0);
        }

        // Clear out old slots
        while self.first_observed_time_of_slot.len() > MAX_SLOT_OBSERVATIONS {
            #[allow(clippy::expect_used, reason = "len checked above")]
            let oldest_slot = *self
                .first_observed_time_of_slot
                .keys()
                .next()
                .expect("first_observed_time_of_slot is empty");
            self.first_observed_time_of_slot.remove(&oldest_slot);
        }
    }
}
