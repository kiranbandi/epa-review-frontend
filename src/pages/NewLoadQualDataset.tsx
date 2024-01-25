// @ts-nocheck
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from "@ionic/react";
import { csvParse, DSVRowArray } from "d3-dsv";
import { useEffect, useRef, useState } from "react";
import FileSaver from 'file-saver';

type QualScoreMap = {
  qual: string,
  q1: string,
  q2: string,
  q3: string,
}

const Dashboard: React.FC = () => {

  // Model loading
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File>();
  const [processingCount, setProcessingCount] = useState(0);
  const [data, setData] = useState<DSVRowArray<string>>();
  const [dataPreviewLimit, setDataPreviewLimit] = useState(10);
  const [feedbackColumns, setFeedbackColumns] = useState(["Feedback"]);

  const [processing, setProcessing] = useState(false);
  const [presentAlert] = useIonAlert();

  // Create a reference to the worker object.
  const worker = useRef<Worker | null>(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(`${process.env.PUBLIC_URL}/assets/worker.js`, {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case 'ready':
          // Pipeline ready: Model loaded and the worker is ready to accept narrative comments for processing.
          setReady(true);
          break;
        case 'progress':
          setProcessingCount(e.data.progressCount);
          break;
        case 'complete':
          saveCSVresults(e.data.output);
          break;
      }
    };
    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);
    // Define a cleanup function for when the component is unmounted.
    return () => worker.current?.removeEventListener('message', onMessageReceived);
  });

  // Trigger worker with an empty comment list to start loading the models
  useEffect(() => { worker.current?.postMessage({ comments: [] }) }, [])

  function generateQuALScores(comments: string[]) {
    setProcessingCount(0);
    worker.current?.postMessage({ comments });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/new" />
          </IonButtons>
          <IonTitle>Generate QuAL Scores</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>

        {!ready &&
          <IonCard>
            <IonCardHeader>
              <IonCardTitle> Loading QuAL Score Models... Please Wait...  </IonCardTitle>
            </IonCardHeader>
          </IonCard>}

        {renderFileSelectionCard(!ready || (!!(file && data)))}
        {renderColumnSelectionCard(
          !(file && data && ready) || processing
        )}


        {processing &&
          <IonCard>
            <IonCardHeader>
              <IonCardTitle> {`Processed ${processingCount}/${data.length} Records`} </IonCardTitle>
            </IonCardHeader>
          </IonCard>}

      </IonContent>
    </IonPage>
  );

  function renderColumnSelectionCard(disabled: boolean) {
    return (
      <IonCard disabled={disabled}>
        <IonCardHeader>
          <IonCardTitle>
            Preview your data and label the feedback column below.
          </IonCardTitle>
          <IonText>
            <p>
              The qualscore generation model needs to know which column of your
              dataset contains the narrative feedback. Review the sample data that is displayed below and
              indicate the title of the column containing the narrative
              feedback.
            </p>
          </IonText>
        </IonCardHeader>
        <IonCardContent>
          <IonItem>
            <IonLabel position="stacked">Preview limit</IonLabel>
            <IonInput
              disabled={disabled}
              type="number"
              value={dataPreviewLimit}
              onIonChange={({ detail }) =>
                setDataPreviewLimit(+(detail.value || "0"))
              }
            ></IonInput>
          </IonItem>
          {data && (
            <>
              <IonText>
                <h2>Below are up to first {dataPreviewLimit} records</h2>
              </IonText>
              <div style={{ maxHeight: "30rem", overflowY: "auto" }}>
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      {data?.columns.map((columnName, i) => (
                        <th key={i}>{columnName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.slice(0, dataPreviewLimit).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((columnValue, i) => (
                          <td key={i}>{columnValue}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <IonItem>
            <IonLabel position="stacked">
              Title(s) of the column(s) containing narrative feedback (separate
              multiple titles with commas and no following space)
            </IonLabel>
            <IonInput
              disabled={disabled}
              value={feedbackColumns.join(",")}
              onIonChange={({ detail }) =>
                setFeedbackColumns(detail.value?.split(",") || [])
              }
            ></IonInput>
          </IonItem>
          <br />
          <IonButton
            disabled={disabled}
            onClick={async () => {
              presentAlert({
                header:
                  "This action may take some time (up to minutes) for large datasets, are you sure to continue?",
                buttons: [
                  {
                    text: "No",
                    role: "cancel",
                  },
                  {
                    text: "Yes",
                    role: "confirm",
                    handler: () => (processCSVFile)(),
                  },
                ],
              });
            }}
          >
            {processing
              ? "Processing..."
              : "Generate QualScores and save the processed file"}
          </IonButton>
          <br />
        </IonCardContent>
      </IonCard>
    );
  }


  function renderFileSelectionCard(disabled: boolean) {
    return (
      <IonCard disabled={disabled}>
        <IonCardHeader>
          <IonCardTitle>Load your CSV File.</IonCardTitle>
          <IonText>
            Select the CSV file containing the narrative feedback that you would like to
            process on the QuAL score generation tool.
            Please note that this file will NOT be uploaded to our
            servers, but reformatted on your local system into a new file for
            you to download.
          </IonText>
        </IonCardHeader>
        <IonCardContent>
          <IonButton disabled={disabled} onClick={() => loadCSVFile()}>
            Select file
          </IonButton>
          <br />
          <IonText>{`${file
            ? `${file.name} - ${data ? `${data.length} Records` : "Not Loaded"
            }`
            : ""
            }`}</IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  async function loadCSVFile() {
    const fileHandle = (await (window as any).showOpenFilePicker())?.[0];
    const file = (await fileHandle.getFile()) as File;
    setFile(file);
    const fileContent = await file?.text();
    const data = csvParse(fileContent || "");
    if (data.length > 0) {
      setData(data);
    }
  }

  function saveCSVresults(comments: QualScoreMap[]) {

    const dataMap = data?.map((e, i) => ({ ...e, ...comments[i] }));

    var convertedData = dataMap?.map((dataPoint) => {
      return Object.values(dataPoint)?.map((value) => {
        if (typeof (value) == 'string') {
          //  quick fix hashes seem to be breaking the code so we will replace them with enclosed text of hash
          if (value.indexOf("#") > -1) {
            value = value.split("#").join("-hash-");
          }
          return '"' + value.split('"').join('""') + '"';
        } else return '"' + value + '"';
      }).join(',');
    });

    // Add file headers to top of the file
    convertedData.unshift([...data.columns, 'QuAL Score', 'Evidence Score', 'Suggestion Given', 'Suggestion Linked']);
    var blob = new Blob(["\ufeff" + convertedData.join("\n")], { type: "text/csv;charset=utf-8" });
    var timeStamp = (new Date()).toString().split("GMT")[0];
    FileSaver.saveAs(blob, "rcm-data" + "-" + timeStamp + ".csv");

    alert("QuAL score generation finished and the output file is saved.");
    setProcessing(false);
  }


  async function processCSVFile() {
    setProcessing(true);
    const records = data
      ?.map((record) => {
        return feedbackColumns?.map((columnName) => record[columnName]).join(' ').split('\n').join(" ");
      });

    if (records && records?.length > 0) {
      generateQuALScores(records as string[]);
    }
  }

};

export default Dashboard;
