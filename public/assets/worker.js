
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

// Since we will download the model from the Hugging Face Hub, we can skip the local model check
env.allowLocalModels = false;

const task = 'text-classification';
let q1Model = null, q2Model = null, q3Model = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {

    // If the models are not ready, load them and let the main thread know they are ready to use
    // Retrieve the 3 qualscore model pipelines. When called for the first time,
    // this will load the pipelines and save them for future use.
    if (q1Model == null || q2Model == null || q3Model == null) {
        q1Model = await pipeline(task, 'kiranbandi/nlp-qual-q1');
        q2Model = await pipeline(task, 'kiranbandi/nlp-qual-q2i');
        q3Model = await pipeline(task, 'kiranbandi/nlp-qual-q3i');
        self.postMessage({ status: 'ready' });
    }

    // if the models are ready and comment data is available to process
    else {
        if (event.data && event.data.comments && event.data.comments.length > 0) {
            console.log("started processing comments");
            let qualScoreList = [];

            let progressCount = 1;
            for (const comment of event.data.comments) {
                
                self.postMessage({ status: 'progress', progressCount });

                let q1 = await q1Model([comment]);
                let q2i = await q2Model([comment]);
                let q3i = await q3Model([comment]);

                let q1Label = q1[0].label.slice(6),
                    q2Label = q2i[0].label.slice(6),
                    q3Label = q3i[0].label.slice(6);
                // if no feedback given, then feedback linked would also be absent so override it to false.
                if (q2Label == '1') { q3Label = '1' }
                // Generate overall qual score from the other three scores.
                let qualLabel = +q1Label + (q2Label == '0' ? 1 : 0) + (q3Label == '0' ? 1 : 0);

                qualScoreList.push({ 'qual': qualLabel, 'q1': q1Label, 'q2i': q2Label == '0' ? 'Yes' : 'No', 'q3i': q3Label == '0' ? 'Yes' : 'No' });

                progressCount += 1;
            }

            console.log("processing comments complete");
            // Send the output back to the main thread
            self.postMessage({
                status: 'complete',
                output: qualScoreList,
            });
        }
    }

});
